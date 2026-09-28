"use client";

import { useState } from "react";
import type { CityKey } from "@/lib/types";
import { LeftSidebar } from "./left-sidebar";
import { CenterPanel } from "./center-panel";
import { RightPanel } from "./right-panel";
import { BoroughDetailDialog } from "./borough-detail-dialog";
import { DemoModeBadge } from "./demo-mode-badge";
import { useInterventionStream } from "@/lib/hooks/use-intervention-stream";

export function Dashboard({
  staticMode,
  snapshotGeneratedAt,
}: {
  staticMode: boolean;
  snapshotGeneratedAt: string | null;
}) {
  const [city, setCity] = useState<CityKey>("rotterdam");
  const [selected, setSelected] = useState<{ borough: string; city: CityKey } | null>(null);
  const [detailBorough, setDetailBorough] = useState<string | null>(null);
  const stream = useInterventionStream({ staticMode });

  const runForBorough = (borough: string, cityKey: CityKey) => {
    setSelected({ borough, city: cityKey });
    stream.start({ borough, city: cityKey });
  };

  return (
    <div
      className="grid w-screen overflow-hidden bg-canvas"
      style={{
        height: "100vh",
        gridTemplateColumns: "22% 50% 28%",
        // minmax(0, 1fr) is the standard fix for grid children that want to
        // shrink and trigger their own overflow-y-auto. Without this, the row
        // track grows to fit content and the right panel extends past the
        // viewport with no scroll.
        gridTemplateRows: "minmax(0, 1fr)",
      }}
    >
      {staticMode ? null : <DemoModeBadge />}
      <LeftSidebar
        city={city}
        onCityChange={(c) => {
          setCity(c);
          setSelected(null);
          stream.reset();
        }}
        onSelect={(n) => runForBorough(n.id, city)}
      />
      <CenterPanel
        city={city}
        onCityChange={(c) => {
          setCity(c);
          setSelected(null);
          stream.reset();
        }}
        onBoroughClick={(b) => setDetailBorough(b)}
        staticMode={staticMode}
        snapshotGeneratedAt={snapshotGeneratedAt}
      />
      <RightPanel
        city={city}
        selectedName={selected?.borough ?? null}
        focusedBuurt={typeof stream.info.buurt === "string" ? stream.info.buurt : null}
        running={stream.running}
        steps={stream.steps}
        messages={stream.messages}
        strategy={stream.strategy}
        error={stream.error}
        notice={stream.notice}
        replay={stream.replay}
        staticMode={staticMode}
      />
      <BoroughDetailDialog
        open={detailBorough !== null}
        onOpenChange={(open) => {
          if (!open) setDetailBorough(null);
        }}
        borough={detailBorough}
        city={city}
        onGenerate={() => {
          if (detailBorough) runForBorough(detailBorough, city);
        }}
        staticMode={staticMode}
      />
    </div>
  );
}
