"use client";
import { useCallback, useRef, useState } from "react";
import type {
  AgentTraceEvent,
  CityKey,
  ClusterMessage,
  InterventionStrategy,
  StepStatus,
} from "@/lib/types";

export type TraceStep = {
  id: string;
  label: string;
  status: "pending" | StepStatus;
  detail?: string;
};

const DEFAULT_STEPS: TraceStep[] = [
  { id: "s1", label: "Retrieving Supermemory context", status: "pending" },
  { id: "s2", label: "Searching local activities on the web", status: "pending" },
  { id: "s3", label: "Identifying resident clusters", status: "pending" },
  { id: "s4", label: "Generating bespoke intervention strategy", status: "pending" },
  { id: "s5", label: "Personalising messages per cluster", status: "pending" },
  { id: "s6", label: "Storing strategy and messages", status: "pending" },
  { id: "s7", label: "Streaming results to dashboard", status: "pending" },
];

export type SimulateTarget =
  | { neighbourhoodId: string }
  | { borough: string; city: CityKey };

export function useInterventionStream() {
  const [steps, setSteps] = useState<TraceStep[]>(DEFAULT_STEPS);
  const [messages, setMessages] = useState<ClusterMessage[]>([]);
  const [strategy, setStrategy] = useState<InterventionStrategy | null>(null);
  const [info, setInfo] = useState<Record<string, string | number>>({});
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setSteps(DEFAULT_STEPS.map((s) => ({ ...s })));
    setMessages([]);
    setStrategy(null);
    setInfo({});
    setError(null);
  }, []);

  const start = useCallback(
    async (target: SimulateTarget) => {
      reset();
      setRunning(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(target),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          setError(`Simulate failed (${res.status})`);
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
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            if (!frame.startsWith("data:")) continue;
            const json = frame.slice(5).trim();
            if (!json) continue;
            try {
              const event = JSON.parse(json) as AgentTraceEvent;
              if (event.type === "step") {
                setSteps((prev) =>
                  prev.map((s) =>
                    s.id === event.id
                      ? { ...s, status: event.status, detail: event.detail ?? s.detail }
                      : s,
                  ),
                );
              } else if (event.type === "strategy") {
                setStrategy(event.strategy);
              } else if (event.type === "cluster_message") {
                setMessages((prev) => [...prev, event.message]);
              } else if (event.type === "info") {
                setInfo((prev) => ({ ...prev, [event.key]: event.value }));
              } else if (event.type === "error") {
                setError(event.message);
              }
            } catch {
              /* ignore malformed chunk */
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setRunning(false);
      }
    },
    [reset],
  );

  return { steps, messages, strategy, info, error, running, start, reset };
}
