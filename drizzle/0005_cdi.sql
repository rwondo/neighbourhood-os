ALTER TABLE neighbourhoods ADD COLUMN IF NOT EXISTS cdi real NOT NULL DEFAULT 0;
ALTER TABLE neighbourhoods ADD COLUMN IF NOT EXISTS borough text;
ALTER TABLE neighbourhoods ADD COLUMN IF NOT EXISTS cdi_breakdown jsonb;
CREATE INDEX IF NOT EXISTS neighbourhoods_borough_idx ON neighbourhoods (borough);
