import type { AgentTraceEvent } from "@/lib/types";

export function createSSEStream() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const send = (event: AgentTraceEvent) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };
  const close = () => controller.close();
  return { stream, send, close };
}
