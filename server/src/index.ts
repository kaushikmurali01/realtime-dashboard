/**
 * Server entry point. Builds the Fastify app, registers plugins, starts listening.
 */
import { buildApp } from "./app.js";
import { initPubSub } from "./pubsub.js";
import { logger } from "./logger.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

async function main() {
  await initPubSub();

  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    logger.info({ port: PORT, host: HOST }, "server_started");
  } catch (err) {
    logger.error({ err }, "server_start_failed");
    process.exit(1);
  }

  // Graceful shutdown
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, async () => {
      logger.info({ sig }, "shutting_down");
      await app.close();
      process.exit(0);
    });
  }
}

main();
