"use client";
import { useCallback, useState } from "react";
import type { AgentTraceEvent, ClusterMessage, InterventionStrategy } from "@/lib/types";

export type TraceStep = { id: string; label: string; status: "pending" | "active" | "completed" };

const DEFAULT_STEPS: TraceStep[] = [
  { id: "s1", label: "Analysing neighbourhood signals", status: "pending" },
  { id: "s2", label: "Retrieving CBS buurt profile", status: "pending" },
  { id: "s3", label: "Searching local activities", status: "pending" },
  { id: "s4", label: "Querying past interventions", status: "pending" },
  { id: "s5", label: "Identifying resident clusters", status: "pending" },
  { id: "s6", label: "Generating strategy", status: "pending" },
];

export function useInterventionStream() {
  const [steps, setSteps] = useState<TraceStep[]>(DEFAULT_STEPS);
  const [messages, setMessages] = useState<ClusterMessage[]>([]);
  const [strategy, setStrategy] = useState<InterventionStrategy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const reset = useCallback(() => {
    setSteps(DEFAULT_STEPS);
    setMessages([]);
    setStrategy(null);
    setError(null);
  }, []);

  const start = useCallback(async (neighbourhoodId: string) => {
    reset();
    setRunning(true);
    const res = await fetch("/api/simulate", { method: "POST", body: JSON.stringify({ neighbourhoodId }) });
    if (!res.body) {
      setRunning(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const c of chunks) {
        if (!c.startsWith("data:")) continue;
        const json = c.slice(5).trim();
        if (!json) continue;
        try {
          const event = JSON.parse(json) as AgentTraceEvent;
          if (event.type === "step") {
            setSteps((prev) => prev.map((s) => (s.id === event.id ? { ...s, status: event.status } : s)));
          } else if (event.type === "strategy") {
            setStrategy(event.strategy);
          } else if (event.type === "cluster_message") {
            setMessages((prev) => [...prev, event.message]);
          } else if (event.type === "error") {
            setError(event.message);
          }
        } catch {
          /* ignore malformed chunk */
        }
      }
    }
    setRunning(false);
  }, [reset]);

  return { steps, messages, strategy, error, running, start, reset };
}
