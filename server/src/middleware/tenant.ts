/**
 * Tenant context middleware.
 *
 * Extracts the JWT, sets the PostgreSQL session variable `app.tenant_id`,
 * which is what our row-level security policies use to filter rows.
 *
 * This is the linchpin of multi-tenant data isolation. If this hook
 * doesn't run, RLS will reject queries (since `current_setting('app.tenant_id')`
 * will throw). That's intentional — better to fail loud than silently leak.
 */
import type { FastifyRequest, FastifyReply } from "fastify";

import { db } from "../db/index.js";
import { sql } from "drizzle-orm";

const PUBLIC_PATHS = new Set(["/health", "/api/auth/login", "/api/auth/register", "/ws"]);

export async function tenantContext(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (PUBLIC_PATHS.has(req.url.split("?")[0]!)) return;

  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ error: "unauthorized" });
    return;
  }

  const user = req.user as { sub: string; tenantId: string };

  // SET LOCAL only applies inside a transaction. We attach the tenant_id to
  // the request and let DB helpers wrap each query in a transaction that sets it.
  (req as unknown as { tenantId: string }).tenantId = user.tenantId;
  (req as unknown as { userId: string }).userId = user.sub;
}

/**
 * Helper: run a callback inside a transaction with `app.tenant_id` set.
 * All queries inside the callback are auto-filtered by RLS.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: typeof db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.tenant_id = ${tenantId}`);
    return fn(tx);
  });
}
