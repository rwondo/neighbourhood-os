// isStaticMode() is server-only: in the browser DATABASE_URL is always undefined.

/**
 * Static snapshot mode serves precomputed CDI data from
 * src/lib/data/static-snapshot.json and disables the live agent pipeline.
 * It is on whenever DATABASE_URL is missing, or when STATIC_SNAPSHOT=1
 * forces it (useful for testing static mode with a .env that has a DB).
 */
export function isStaticMode(): boolean {
  return process.env.STATIC_SNAPSHOT === "1" || !process.env.DATABASE_URL?.trim();
}

export const STATIC_MODE_MESSAGE = "Live agent runs need a database and API keys (see README).";

export function staticModeResponse(): Response {
  return Response.json({ error: "static_mode", message: STATIC_MODE_MESSAGE }, { status: 503 });
}
