import { InterventionGenerator } from "./intervention-generator";
import { AgentTrace } from "./agent-trace";
import { ChannelPreviews } from "./channel-previews";
import { ImpactChart } from "./impact-chart";
import type { TraceStep } from "@/lib/hooks/use-intervention-stream";
import type { ClusterMessage, InterventionStrategy } from "@/lib/types";

export function RightPanel({
  selectedName,
  running,
  steps,
  messages,
  strategy,
  onRun,
}: {
  selectedName: string | null;
  running: boolean;
  steps: TraceStep[];
  messages: ClusterMessage[];
  strategy: InterventionStrategy | null;
  onRun: () => void;
}) {
  return (
    <aside className="flex h-full w-full flex-col border-l border-hairline bg-panel">
      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Section title="Intervention Generator">
          <InterventionGenerator selectedName={selectedName} running={running} onRun={onRun} />
        </Section>

        <Section title="Agent Trace" meta="6 steps">
          <AgentTrace steps={steps} />
        </Section>

        <Section title="Channel Previews" meta={`${messages.length || 0} variants`}>
          <ChannelPreviews messages={messages} />
        </Section>

        <Section title="Impact Projection" meta="6-week forecast">
          <ImpactChart weeks={strategy?.weeks ?? null} />
        </Section>
      </div>
    </aside>
  );
}

function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-hairline px-4 py-3 last:border-b-0">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </h2>
        {meta ? (
          <span className="font-mono text-[10px] tabular text-muted-foreground/70">{meta}</span>
        ) : null}
      </header>
      {children}
    </section>
  );
}
