"use client";
import { useCallback, useRef, useState } from "react";
import { resolveDemoSnapshot } from "@/lib/demo-data";
import type { DemoSnapshot } from "@/lib/demo-data";
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

// Wall-clock timeout for the entire SSE stream — prevents a frozen agent trace if
// the server hangs without emitting `done`. Set higher than the orchestrator's
// per-step timeouts combined.
const STREAM_WALL_CLOCK_MS = 180_000;

export type SimulateTarget =
  | { neighbourhoodId: string }
  | { borough: string; city: CityKey };

type StepEvent = Extract<AgentTraceEvent, { type: "step" }>;

function applyEventToFrame(
  event: AgentTraceEvent,
  setters: {
    setSteps: React.Dispatch<React.SetStateAction<TraceStep[]>>;
    setStrategy: React.Dispatch<React.SetStateAction<InterventionStrategy | null>>;
    setMessages: React.Dispatch<React.SetStateAction<ClusterMessage[]>>;
    setInfo: React.Dispatch<React.SetStateAction<Record<string, string | number>>>;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
  },
): void {
  if (event.type === "step") {
    const step: StepEvent = event;
    setters.setSteps((prev) =>
      prev.map((s) =>
        s.id === step.id
          ? { ...s, status: step.status, detail: step.detail ?? s.detail, label: step.label ?? s.label }
          : s,
      ),
    );
  } else if (event.type === "strategy") {
    setters.setStrategy(event.strategy);
  } else if (event.type === "cluster_message") {
    setters.setMessages((prev) => [...prev, event.message]);
  } else if (event.type === "cluster_message_enriched") {
    setters.setMessages((prev) =>
      prev.map((m) =>
        m.clusterId === event.clusterId && m.channel === event.channel
          ? {
              ...m,
              creativeUrl:
                event.creativeUrl !== undefined ? event.creativeUrl : m.creativeUrl,
              creativeStatus: event.creativeStatus ?? m.creativeStatus,
              creativePrompt: event.creativePrompt ?? m.creativePrompt,
              qrCodeUrl: event.qrCodeUrl !== undefined ? event.qrCodeUrl : m.qrCodeUrl,
              joinUrl: event.joinUrl ?? m.joinUrl,
            }
          : m,
      ),
    );
  } else if (event.type === "info") {
    setters.setInfo((prev) => ({ ...prev, [event.key]: event.value }));
  } else if (event.type === "error") {
    setters.setError(event.message);
  }
}

export function useInterventionStream() {
  const [steps, setSteps] = useState<TraceStep[]>(DEFAULT_STEPS);
  const [messages, setMessages] = useState<ClusterMessage[]>([]);
  const [strategy, setStrategy] = useState<InterventionStrategy | null>(null);
  const [info, setInfo] = useState<Record<string, string | number>>({});
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const reset = useCallback(() => {
    setSteps(DEFAULT_STEPS.map((s) => ({ ...s })));
    setMessages([]);
    setStrategy(null);
    setInfo({});
    setError(null);
  }, []);

  const start = useCallback(
    async (target: SimulateTarget) => {
      // Abort any in-flight stream first so its `finally` runs before we proceed,
      // and bump the runId so the old run's setRunning(false) can't clobber ours.
      abortRef.current?.abort();
      const myRunId = ++runIdRef.current;
      reset();
      setRunning(true);
      const controller = new AbortController();
      abortRef.current = controller;

      // Wall-clock failsafe so the spinner cannot hang forever.
      const wallClock = setTimeout(() => {
        if (runIdRef.current === myRunId) controller.abort();
      }, STREAM_WALL_CLOCK_MS);

      const setters = { setSteps, setStrategy, setMessages, setInfo, setError };

      // Demo-mode fast path: if `?demo=1` (or `?demo=<borough>`) is in the URL
      // and the target borough has a registered snapshot, replay it with
      // realistic per-step delays instead of hitting /api/simulate. This makes
      // the whole pipeline deterministic and offline-able for the live pitch.
      const demoBorough = "borough" in target ? target.borough : null;
      const demoCity = "city" in target ? target.city : null;
      const snapshot: DemoSnapshot | null = resolveDemoSnapshot(demoBorough, demoCity);
      if (snapshot) {
        try {
          await replaySnapshot(snapshot, controller.signal, runIdRef, myRunId, setters);
        } finally {
          clearTimeout(wallClock);
          if (runIdRef.current === myRunId) setRunning(false);
        }
        return;
      }

      try {
        const res = await fetch("/api/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(target),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          if (runIdRef.current === myRunId) setError(`Simulate failed (${res.status})`);
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
              if (runIdRef.current === myRunId) applyEventToFrame(event, setters);
            } catch {
              /* ignore malformed chunk */
            }
          }
        }
        // Flush any trailing frame that didn't end with \n\n before close.
        const tail = buffer.trim();
        if (tail.startsWith("data:")) {
          const json = tail.slice(5).trim();
          if (json) {
            try {
              const event = JSON.parse(json) as AgentTraceEvent;
              if (runIdRef.current === myRunId) applyEventToFrame(event, setters);
            } catch {
              /* ignore malformed chunk */
            }
          }
        }
      } catch (err) {
        if (runIdRef.current !== myRunId) return; // a newer run took over
        const name = (err as { name?: string }).name;
        if (name === "AbortError") {
          // Distinguish "user/borough switch abort" from "wall-clock timeout".
          if (controller.signal.aborted && runIdRef.current === myRunId) {
            // Only surface a timeout error if we're still the current run.
            setError("Request timed out — please try again");
          }
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        clearTimeout(wallClock);
        // Only clear running if this is still the active run — prevents a stale
        // stream's late finally from clobbering a newer run's running=true.
        if (runIdRef.current === myRunId) setRunning(false);
      }
    },
    [reset],
  );

  return { steps, messages, strategy, info, error, running, start, reset };
}

async function replaySnapshot(
  snapshot: DemoSnapshot,
  signal: AbortSignal,
  runIdRef: React.RefObject<number>,
  myRunId: number,
  setters: {
    setSteps: React.Dispatch<React.SetStateAction<TraceStep[]>>;
    setStrategy: React.Dispatch<React.SetStateAction<InterventionStrategy | null>>;
    setMessages: React.Dispatch<React.SetStateAction<ClusterMessage[]>>;
    setInfo: React.Dispatch<React.SetStateAction<Record<string, string | number>>>;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
  },
): Promise<void> {
  for (const step of snapshot.stream) {
    if (signal.aborted || runIdRef.current !== myRunId) return;
    await sleepAbortable(step.delayMs, signal);
    if (signal.aborted || runIdRef.current !== myRunId) return;
    // `done` events are emitted by the real backend at end-of-stream and are
    // ignored by the reducer; preserve the same behaviour here.
    if (step.event.type === "done") continue;
    applyEventToFrame(step.event, setters);
  }
}

function sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
