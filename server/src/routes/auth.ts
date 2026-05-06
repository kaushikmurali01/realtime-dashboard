/**
 * Auth routes — login, register, refresh.
 *
 * Passwords hashed with scrypt (built into Node, no extra deps).
 */
import { type FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { db } from "../db/index.js";
import { users, tenants } from "../db/schema.js";
import { eq } from "drizzle-orm";

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  tenantName: z.string().min(1), // creates a new tenant for first user
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", async (req, reply) => {
    const body = RegisterBody.parse(req.body);

    const [tenant] = await db.insert(tenants).values({ name: body.tenantName }).returning();
    if (!tenant) return reply.code(500).send({ error: "tenant create failed" });

    const [user] = await db
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: body.email,
        passwordHash: hashPassword(body.password),
        name: body.name,
      })
      .returning();

    if (!user) return reply.code(500).send({ error: "user create failed" });

    const token = app.jwt.sign({ sub: user.id, tenantId: user.tenantId });
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  });

  app.post("/login", async (req, reply) => {
    const body = LoginBody.parse(req.body);

    const [user] = await db.select().from(users).where(eq(users.email, body.email));

    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      return reply.code(401).send({ error: "invalid credentials" });
    }

    const token = app.jwt.sign({ sub: user.id, tenantId: user.tenantId });
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  });
};
