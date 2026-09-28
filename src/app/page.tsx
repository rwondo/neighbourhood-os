import { connection } from "next/server";
import { Dashboard } from "@/components/dashboard/dashboard";
import { snapshotGeneratedAt } from "@/lib/data/static-snapshot";
import { isStaticMode } from "@/lib/runtime-mode";

export default async function Home() {
  // Render per request so static mode reflects the runtime environment,
  // not whatever env vars happened to be set at build time.
  await connection();
  const staticMode = isStaticMode();
  return (
    <Dashboard
      staticMode={staticMode}
      snapshotGeneratedAt={staticMode ? snapshotGeneratedAt() : null}
    />
  );
}
