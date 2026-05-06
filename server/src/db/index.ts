import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/dashboard";

// Pool config: 20 connections per process, idle timeout 20s.
// Real production sizing: (workers * pool_size) <= max_connections / 2
const sql = postgres(connectionString, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(sql, { schema });
