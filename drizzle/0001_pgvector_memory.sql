CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS memories (
  id text PRIMARY KEY,
  container_tag text NOT NULL,
  kind text NOT NULL DEFAULT 'profile',
  content text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memories_container_idx ON memories (container_tag);
CREATE INDEX IF NOT EXISTS memories_kind_idx ON memories (kind);

CREATE TABLE IF NOT EXISTS chunks (
  id text PRIMARY KEY,
  memory_id text NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  container_tag text NOT NULL,
  position integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chunks_container_idx ON chunks (container_tag);
CREATE INDEX IF NOT EXISTS chunks_trgm_idx ON chunks USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx ON chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS entities (
  id text PRIMARY KEY,
  container_tag text NOT NULL,
  type text NOT NULL,
  name text NOT NULL,
  normalized_name text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (container_tag, type, normalized_name)
);
CREATE INDEX IF NOT EXISTS entities_container_idx ON entities (container_tag);
CREATE INDEX IF NOT EXISTS entities_normalized_idx ON entities (normalized_name);

CREATE TABLE IF NOT EXISTS edges (
  id text PRIMARY KEY,
  container_tag text NOT NULL,
  source_entity text NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_entity text NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relation text NOT NULL,
  weight real NOT NULL DEFAULT 1,
  source_memory_id text REFERENCES memories(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS edges_container_idx ON edges (container_tag);
CREATE INDEX IF NOT EXISTS edges_source_idx ON edges (source_entity);
CREATE INDEX IF NOT EXISTS edges_target_idx ON edges (target_entity);
CREATE INDEX IF NOT EXISTS edges_relation_idx ON edges (relation);
