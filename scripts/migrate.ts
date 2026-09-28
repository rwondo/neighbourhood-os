/**
 * Applies the hand-written SQL migrations in drizzle/ in filename order.
 * Every file is idempotent (IF NOT EXISTS), so re-running is safe.
 *
 *   pnpm db:migrate
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[migrate] DATABASE_URL is not set (see .env.example)");
  process.exit(1);
}

async function main() {
  const dir = path.resolve(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
  const sql = postgres(DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    for (const file of files) {
      await sql.unsafe(readFileSync(path.join(dir, file), "utf-8"));
      console.log(`[migrate] applied ${file}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
