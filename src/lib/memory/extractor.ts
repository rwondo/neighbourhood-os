import { jsonAgentCall } from "@/lib/together";
import type { Entity, Edge } from "./types";

const SYSTEM = `You are a knowledge-graph extractor for a Dutch municipal cohesion platform.
You read a short memory document about a neighbourhood (demographic profile, intervention outcome, or activity note) and emit structured entities and edges.

Allowed entity types: cluster, activity, venue, season, outcome, neighbourhood.
Allowed edge relations: attended, located_at, in_season, resulted_in, targets, mentions.

Rules:
- Normalised names are lower-case ASCII, words separated by single spaces. Example: "Elderly Dutch 65+" -> "elderly dutch 65".
- Output strictly the JSON schema. No prose.
- If unsure, omit. Better to under-extract than fabricate.

Schema:
{
  "entities": [{ "type": "cluster|activity|venue|season|outcome|neighbourhood", "name": "string", "normalized_name": "string" }],
  "edges": [{ "source": "normalized_name", "target": "normalized_name", "relation": "attended|located_at|in_season|resulted_in|targets|mentions", "weight": number }]
}`;

type ExtractorOut = {
  entities: { type: Entity["type"]; name: string; normalized_name: string }[];
  edges: { source: string; target: string; relation: Edge["relation"]; weight?: number }[];
};

export async function extractGraph({
  containerTag,
  memoryId,
  content,
}: {
  containerTag: string;
  memoryId: string;
  content: string;
}): Promise<{ entities: Entity[]; edges: Edge[] }> {
  const out = await jsonAgentCall<ExtractorOut>({
    system: SYSTEM,
    user: `Container: ${containerTag}\nMemory id: ${memoryId}\nContent:\n${content}`,
  }).catch(() => ({ entities: [], edges: [] }) as ExtractorOut);

  const entities: Entity[] = (out.entities ?? []).map((e) => ({
    id: `ent_${containerTag}_${e.type}_${slug(e.normalized_name)}`,
    containerTag,
    type: e.type,
    name: e.name,
    normalizedName: e.normalized_name,
  }));
  const entityByNorm = new Map(entities.map((e) => [e.normalizedName, e]));
  const edges: Edge[] = (out.edges ?? [])
    .map((edge): Edge | null => {
      const src = entityByNorm.get(edge.source);
      const tgt = entityByNorm.get(edge.target);
      if (!src || !tgt) return null;
      return {
        id: `edg_${containerTag}_${src.id}_${edge.relation}_${tgt.id}`,
        containerTag,
        sourceEntity: src.id,
        targetEntity: tgt.id,
        relation: edge.relation,
        weight: edge.weight ?? 1,
        sourceMemoryId: memoryId,
      };
    })
    .filter((e): e is Edge => e !== null);
  return { entities, edges };
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
