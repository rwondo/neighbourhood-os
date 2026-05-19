ALTER TABLE neighbourhoods ADD COLUMN IF NOT EXISTS transit_stops_500m integer NOT NULL DEFAULT 0;
