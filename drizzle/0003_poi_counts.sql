ALTER TABLE neighbourhoods ADD COLUMN IF NOT EXISTS poi_libraries integer NOT NULL DEFAULT 0;
ALTER TABLE neighbourhoods ADD COLUMN IF NOT EXISTS poi_community_centres integer NOT NULL DEFAULT 0;
ALTER TABLE neighbourhoods ADD COLUMN IF NOT EXISTS poi_parks integer NOT NULL DEFAULT 0;
ALTER TABLE neighbourhoods ADD COLUMN IF NOT EXISTS poi_benches integer NOT NULL DEFAULT 0;
ALTER TABLE neighbourhoods ADD COLUMN IF NOT EXISTS poi_cafes integer NOT NULL DEFAULT 0;
ALTER TABLE neighbourhoods ADD COLUMN IF NOT EXISTS poi_sports integer NOT NULL DEFAULT 0;
ALTER TABLE neighbourhoods ADD COLUMN IF NOT EXISTS poi_intersections integer NOT NULL DEFAULT 0;
