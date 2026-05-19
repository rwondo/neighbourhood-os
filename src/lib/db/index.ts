import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "postgres://noop:noop@127.0.0.1:5432/noop";
const queryClient = postgres(url, { prepare: false, max: 5 });
export const db = drizzle(queryClient, { schema });
export { schema };
