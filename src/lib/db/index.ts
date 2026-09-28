import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function connect(url: string) {
  return drizzle(postgres(url, { prepare: false, max: 5 }), { schema });
}

export type Database = ReturnType<typeof connect>;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set. Start Postgres with `docker compose up -d`, " +
        "copy .env.example to .env and set DATABASE_URL (see README).",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

let instance: Database | undefined;

/**
 * Returns the shared Drizzle client, connecting on first use. Importing this
 * module never throws, so the app can build and run in static snapshot mode
 * without a database; only code paths that actually query need DATABASE_URL.
 */
export function getDb(): Database {
  if (instance) return instance;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new DatabaseNotConfiguredError();
  instance = connect(url);
  return instance;
}

export { schema };
