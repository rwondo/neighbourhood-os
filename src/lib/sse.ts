import type { AgentTraceEvent } from "@/lib/types";

export function createSSEStream() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      closed = true;
    },
  });
  const send = (event: AgentTraceEvent): void => {
    if (closed) return;
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch {
      // Client disconnected mid-stream — controller is already closed.
      closed = true;
    }
  };
  const close = (): void => {
    if (closed) return;
    closed = true;
    try {
      controller.close();
    } catch {
      /* already closed by client cancel */
    }
  };
  return { stream, send, close };
}
