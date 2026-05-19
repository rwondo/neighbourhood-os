CREATE TABLE IF NOT EXISTS neighbourhoods (
  id text PRIMARY KEY,
  city varchar(16) NOT NULL,
  buurt_code varchar(16) NOT NULL UNIQUE,
  name text NOT NULL,
  centroid_lng real NOT NULL,
  centroid_lat real NOT NULL,
  pct_living_alone real NOT NULL DEFAULT 0,
  pct_elderly_65 real NOT NULL DEFAULT 0,
  pct_single_parent real NOT NULL DEFAULT 0,
  low_income_index real NOT NULL DEFAULT 0,
  amenity_distance_km real NOT NULL DEFAULT 0,
  population_turnover real NOT NULL DEFAULT 0,
  weather_isolation real NOT NULL DEFAULT 0,
  social_participation_drop real NOT NULL DEFAULT 0,
  score real NOT NULL DEFAULT 70,
  trend varchar(8) NOT NULL DEFAULT 'flat',
  raw jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS neighbourhoods_city_idx ON neighbourhoods (city);
CREATE INDEX IF NOT EXISTS neighbourhoods_score_idx ON neighbourhoods (score);

CREATE TABLE IF NOT EXISTS interventions (
  id text PRIMARY KEY,
  neighbourhood_id text NOT NULL,
  rationale text NOT NULL,
  strategy jsonb NOT NULL,
  predicted_score_gain real NOT NULL DEFAULT 0,
  predicted_connections integer NOT NULL DEFAULT 0,
  cost_per_connection_eur real NOT NULL DEFAULT 0,
  weeks jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS interventions_neighbourhood_idx ON interventions (neighbourhood_id);

CREATE TABLE IF NOT EXISTS campaigns (
  id text PRIMARY KEY,
  neighbourhood_id text NOT NULL,
  intervention_id text,
  shock_text text,
  channels jsonb NOT NULL,
  clusters jsonb NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'draft',
  outcomes jsonb,
  approved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS campaigns_neighbourhood_idx ON campaigns (neighbourhood_id);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns (status);

CREATE TABLE IF NOT EXISTS cluster_messages (
  id text PRIMARY KEY,
  campaign_id text,
  intervention_id text NOT NULL,
  cluster_id text NOT NULL,
  channel varchar(16) NOT NULL,
  language varchar(8) NOT NULL DEFAULT 'nl',
  tone text,
  message text NOT NULL,
  pdf_url text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cluster_messages_intervention_idx ON cluster_messages (intervention_id);
CREATE INDEX IF NOT EXISTS cluster_messages_campaign_idx ON cluster_messages (campaign_id);

CREATE TABLE IF NOT EXISTS agent_runs (
  id text PRIMARY KEY,
  intervention_id text,
  neighbourhood_id text NOT NULL,
  steps jsonb NOT NULL,
  total_ms integer NOT NULL DEFAULT 0,
  ok boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_runs_neighbourhood_idx ON agent_runs (neighbourhood_id);

CREATE TABLE IF NOT EXISTS score_history (
  id text PRIMARY KEY,
  neighbourhood_id text NOT NULL,
  score real NOT NULL,
  weather_isolation real,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS score_history_neighbourhood_idx ON score_history (neighbourhood_id);
CREATE INDEX IF NOT EXISTS score_history_recorded_idx ON score_history (recorded_at);
