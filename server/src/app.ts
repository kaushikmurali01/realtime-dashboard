/**
 * Fastify app construction. Separated from index.ts so tests can build an
 * app instance without binding to a port.
 */
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";

import { dashboardRoutes } from "./routes/dashboards.js";
import { authRoutes } from "./routes/auth.js";
import { wsHandler } from "./ws.js";
import { tenantContext } from "./middleware/tenant.js";
import { logger } from "./logger.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ loggerInstance: logger });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? "dev-secret-do-not-use-in-prod",
  });

  await app.register(websocket, {
    options: { maxPayload: 64 * 1024 }, // 64KB max — block oversize messages
  });

  // Tenant context middleware: extracts tenant_id from JWT and sets it in
  // PostgreSQL session for row-level security to apply.
  app.addHook("preHandler", tenantContext);

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(dashboardRoutes, { prefix: "/api/dashboards" });

  // WebSocket endpoint
  app.register(async (instance) => {
    instance.get("/ws", { websocket: true }, wsHandler);
  });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
