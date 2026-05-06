/**
 * Redis pub/sub bridge.
 *
 * We need TWO Redis connections:
 *   - publisher: regular client, can do any command
 *   - subscriber: in subscribed mode, can ONLY do (un)subscribe + ping
 *
 * Mixing them causes "Connection in subscriber mode" errors.
 */
import Redis from "ioredis";

import { logger } from "./logger.js";

let publisher: Redis | null = null;
let subscriber: Redis | null = null;

const handlers = new Map<string, Set<(msg: unknown) => void>>();

export async function initPubSub(): Promise<void> {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  publisher = new Redis(url, { lazyConnect: true });
  subscriber = new Redis(url, { lazyConnect: true });

  await publisher.connect();
  await subscriber.connect();

  subscriber.on("message", (channel, raw) => {
    const set = handlers.get(channel);
    if (!set) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      logger.warn({ channel }, "pubsub_invalid_json");
      return;
    }
    for (const handler of set) {
      try {
        handler(parsed);
      } catch (err) {
        logger.error({ err, channel }, "pubsub_handler_error");
      }
    }
  });

  logger.info("pubsub_initialized");
}

export async function publish(channel: string, message: unknown): Promise<void> {
  if (!publisher) throw new Error("pubsub not initialized");
  await publisher.publish(channel, JSON.stringify(message));
}

export async function subscribe(
  channel: string,
  handler: (msg: unknown) => void,
): Promise<() => void> {
  if (!subscriber) throw new Error("pubsub not initialized");

  if (!handlers.has(channel)) {
    handlers.set(channel, new Set());
    await subscriber.subscribe(channel);
  }
  handlers.get(channel)!.add(handler);

  return () => {
    const set = handlers.get(channel);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      handlers.delete(channel);
      // Fire-and-forget: don't await unsubscribe in the disposer
      void subscriber!.unsubscribe(channel);
    }
  };
}
