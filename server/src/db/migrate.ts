/**
 * Drizzle migration runner. Run with: npm run db:migrate
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/dashboard";
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);

  console.log("running drizzle migrations...");
  await migrate(db, { migrationsFolder: join(__dirname, "../../drizzle") });

  console.log("applying RLS policies...");
  const rlsSql = readFileSync(join(__dirname, "rls.sql"), "utf-8");
  await sql.unsafe(rlsSql);

  console.log("migrations complete");
  await sql.end();
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
