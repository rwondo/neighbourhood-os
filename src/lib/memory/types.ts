export type MemoryDoc = {
  id: string;
  containerTag: string;
  kind: "profile" | "outcome" | "note";
  content: string;
  metadata?: Record<string, unknown>;
};

export type Chunk = {
  id: string;
  memoryId: string;
  containerTag: string;
  position: number;
  content: string;
};

export type Entity = {
  id: string;
  containerTag: string;
  type: "cluster" | "activity" | "venue" | "season" | "outcome" | "neighbourhood";
  name: string;
  normalizedName: string;
  metadata?: Record<string, unknown>;
};

export type Edge = {
  id: string;
  containerTag: string;
  sourceEntity: string;
  targetEntity: string;
  relation: "attended" | "located_at" | "in_season" | "resulted_in" | "targets" | "mentions";
  weight: number;
  sourceMemoryId?: string;
  metadata?: Record<string, unknown>;
};

export type RetrievalHit = {
  content: string;
  memoryId: string;
  containerTag: string;
  score: number;
  source: "vector" | "lexical" | "graph";
  metadata?: Record<string, unknown>;
};
