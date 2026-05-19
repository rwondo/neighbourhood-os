import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set — cannot initialise DB client. " +
      "Copy .env.example to .env and fill in the Supabase connection string.",
  );
}
const queryClient = postgres(url, { prepare: false, max: 5 });
export const db = drizzle(queryClient, { schema });
export { schema };
