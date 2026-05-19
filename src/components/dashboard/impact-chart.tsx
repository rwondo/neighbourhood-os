"use client";

import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { IMPACT_PROJECTION } from "@/lib/mock-data";

export function ImpactChart({ weeks }: { weeks: { week: number; score: number }[] | null }) {
  const data = weeks && weeks.length ? weeks : IMPACT_PROJECTION;
  const start = data[0];
  const end = data[data.length - 1];
  return (
    <div className="rounded-lg border border-hairline bg-panel p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold tracking-tight text-foreground">Impact Projection</h3>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono tabular text-[16px] font-medium text-teal">+{end.score - start.score}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">6w</span>
        </div>
      </div>
      <div className="mt-2 h-[110px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, bottom: 4, left: -16 }}>
            <CartesianGrid stroke="oklch(0.93 0.004 250)" strokeDasharray="2 3" vertical={false} />
            <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "oklch(0.55 0.01 250)" }} tickFormatter={(v) => `w${v}`} />
            <YAxis domain={[40, 90]} ticks={[40, 60, 80]} tickLine={false} axisLine={false} width={28} tick={{ fontSize: 9, fill: "oklch(0.55 0.01 250)" }} />
            <Line type="monotone" dataKey="score" stroke="oklch(0.55 0.105 186)" strokeWidth={2} dot={{ r: 2.5, fill: "white" }} activeDot={{ r: 3.5 }} isAnimationActive={true} />
            <ReferenceDot x={start.week} y={start.score} r={4} fill="white" stroke="oklch(0.68 0.16 65)" strokeWidth={1.5} />
            <ReferenceDot x={end.week} y={end.score} r={5} fill="oklch(0.55 0.105 186)" stroke="white" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span><span className="font-mono tabular text-foreground/70">w{start.week}</span> Intervention starts</span>
        <span><span className="font-mono tabular text-foreground/70">{end.score}</span> · Projected</span>
      </div>
    </div>
  );
}
