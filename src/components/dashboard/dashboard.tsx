"use client";

import { useState } from "react";
import type { CityKey } from "@/lib/types";
import { LeftSidebar } from "./left-sidebar";
import { CenterPanel } from "./center-panel";
import { RightPanel } from "./right-panel";
import { useInterventionStream } from "@/lib/hooks/use-intervention-stream";

export function Dashboard() {
  const [city, setCity] = useState<CityKey>("rotterdam");
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const stream = useInterventionStream();

  return (
    <div
      className="grid h-screen w-screen overflow-hidden bg-canvas"
      style={{ gridTemplateColumns: "22% 50% 28%" }}
    >
      <LeftSidebar
        city={city}
        onCityChange={(c) => {
          setCity(c);
          setSelected(null);
          stream.reset();
        }}
        onSelect={(n) => {
          setSelected({ id: n.id, name: n.name });
          stream.start(n.id);
        }}
      />
      <CenterPanel city={city} onCityChange={setCity} />
      <RightPanel
        selectedName={selected?.name ?? null}
        running={stream.running}
        steps={stream.steps}
        messages={stream.messages}
        strategy={stream.strategy}
        onRun={() => selected && stream.start(selected.id)}
      />
    </div>
  );
}
