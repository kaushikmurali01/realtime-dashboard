/**
 * WebSocket handler.
 *
 * Each client subscribes to a dashboard. Server-side state we track:
 *   1. Local connection map: dashboardId -> Set<WebSocket>
 *   2. Redis pub/sub channel per dashboard: `dashboard:{id}`
 *
 * On message receive:
 *   - validate via Zod
 *   - persist (if it's a state change)
 *   - publish to Redis (fanout to all server nodes)
 *
 * On Redis message receive:
 *   - broadcast to all local connections in that dashboard's set
 *
 * This lets us scale to N server nodes without sticky sessions.
 */
import type { WebSocket } from "ws";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import { subscribe, publish } from "./pubsub.js";
import { logger } from "./logger.js";

/** Per-dashboard set of locally-connected sockets. */
const localConnections = new Map<string, Set<WebSocket>>();

/** Per-dashboard subscription handle, so we only subscribe once per node. */
const subscriptions = new Map<string, () => void>();

const ClientMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscribe"),
    dashboardId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("widget_update"),
    dashboardId: z.string().uuid(),
    widgetId: z.string().uuid(),
    patch: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal("cursor_move"),
    dashboardId: z.string().uuid(),
    x: z.number(),
    y: z.number(),
  }),
]);

type ClientMessage = z.infer<typeof ClientMessage>;

interface ConnectionContext {
  userId: string;
  tenantId: string;
  subscribedTo: Set<string>;
}

export async function wsHandler(socket: WebSocket, req: FastifyRequest) {
  // Auth: JWT token in query param (browsers can't set headers on WS connections)
  const token = (req.query as { token?: string }).token;
  if (!token) {
    socket.close(1008, "missing token");
    return;
  }

  let ctx: ConnectionContext;
  try {
    const payload = await req.server.jwt.verify<{ sub: string; tenantId: string }>(token);
    ctx = { userId: payload.sub, tenantId: payload.tenantId, subscribedTo: new Set() };
  } catch {
    socket.close(1008, "invalid token");
    return;
  }

  logger.info({ userId: ctx.userId }, "ws_connected");

  socket.on("message", async (raw) => {
    let msg: ClientMessage;
    try {
      msg = ClientMessage.parse(JSON.parse(raw.toString()));
    } catch (err) {
      socket.send(JSON.stringify({ type: "error", message: "invalid message" }));
      return;
    }

    if (msg.type === "subscribe") {
      await handleSubscribe(socket, ctx, msg.dashboardId);
    } else {
      // For state-changing messages, broadcast via Redis so all nodes see it
      await publish(`dashboard:${msg.dashboardId}`, {
        ...msg,
        userId: ctx.userId,
        timestamp: Date.now(),
      });
    }
  });

  socket.on("close", () => {
    for (const dashboardId of ctx.subscribedTo) {
      const set = localConnections.get(dashboardId);
      set?.delete(socket);
      if (set && set.size === 0) {
        localConnections.delete(dashboardId);
        // Unsubscribe from Redis when no local connections need this dashboard
        subscriptions.get(dashboardId)?.();
        subscriptions.delete(dashboardId);
      }
    }
    logger.info({ userId: ctx.userId }, "ws_disconnected");
  });
}

async function handleSubscribe(
  socket: WebSocket,
  ctx: ConnectionContext,
  dashboardId: string,
): Promise<void> {
  // TODO: verify the user has access to this dashboard via DB lookup with RLS.

  ctx.subscribedTo.add(dashboardId);

  if (!localConnections.has(dashboardId)) {
    localConnections.set(dashboardId, new Set());
  }
  localConnections.get(dashboardId)!.add(socket);

  // Subscribe to the Redis channel exactly once per node per dashboard
  if (!subscriptions.has(dashboardId)) {
    const unsubscribe = await subscribe(`dashboard:${dashboardId}`, (message) => {
      const set = localConnections.get(dashboardId);
      if (!set) return;
      const data = JSON.stringify(message);
      for (const ws of set) {
        if (ws.readyState === ws.OPEN) {
          ws.send(data);
        }
      }
    });
    subscriptions.set(dashboardId, unsubscribe);
  }

  socket.send(JSON.stringify({ type: "subscribed", dashboardId }));
}
