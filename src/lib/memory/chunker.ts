import type { Chunk } from "./types";

const TARGET = 500;
const OVERLAP = 80;
const SENTENCE_BREAK = /([.!?])\s+(?=[A-Z0-9])/g;

export function chunkText({
  memoryId,
  containerTag,
  text,
}: {
  memoryId: string;
  containerTag: string;
  text: string;
}): Chunk[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  const sentences = splitSentences(normalized);

  const out: Chunk[] = [];
  let buffer = "";
  let position = 0;
  for (const s of sentences) {
    if (buffer.length + s.length + 1 <= TARGET) {
      buffer = buffer ? `${buffer} ${s}` : s;
      continue;
    }
    if (buffer) {
      out.push(makeChunk(memoryId, containerTag, position++, buffer));
      const tail = buffer.slice(Math.max(0, buffer.length - OVERLAP));
      buffer = tail ? `${tail} ${s}` : s;
    } else {
      out.push(makeChunk(memoryId, containerTag, position++, s.slice(0, TARGET)));
      buffer = s.length > TARGET ? s.slice(TARGET - OVERLAP) : "";
    }
  }
  if (buffer.trim()) out.push(makeChunk(memoryId, containerTag, position++, buffer));
  return out;
}

function splitSentences(text: string): string[] {
  const parts = text.split(SENTENCE_BREAK);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const body = parts[i];
    const punct = parts[i + 1] ?? "";
    const sentence = `${body ?? ""}${punct}`.trim();
    if (sentence) out.push(sentence);
  }
  return out;
}

function makeChunk(
  memoryId: string,
  containerTag: string,
  position: number,
  content: string,
): Chunk {
  return {
    id: `chk_${memoryId}_${position}`,
    memoryId,
    containerTag,
    position,
    content: content.trim(),
  };
}
