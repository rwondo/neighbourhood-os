import { pgTable, text, integer, real, timestamp, jsonb, varchar, boolean } from "drizzle-orm/pg-core";

export const neighbourhoods = pgTable("neighbourhoods", {
  id: text("id").primaryKey(),
  city: varchar("city", { length: 16 }).notNull(),
  buurtCode: varchar("buurt_code", { length: 16 }).notNull().unique(),
  name: text("name").notNull(),
  centroidLng: real("centroid_lng").notNull(),
  centroidLat: real("centroid_lat").notNull(),
  pctLivingAlone: real("pct_living_alone").notNull().default(0),
  pctElderly65: real("pct_elderly_65").notNull().default(0),
  pctSingleParent: real("pct_single_parent").notNull().default(0),
  lowIncomeIndex: real("low_income_index").notNull().default(0),
  amenityDistanceKm: real("amenity_distance_km").notNull().default(0),
  populationTurnover: real("population_turnover").notNull().default(0),
  weatherIsolation: real("weather_isolation").notNull().default(0),
  socialParticipationDrop: real("social_participation_drop").notNull().default(0),
  score: real("score").notNull().default(70),
  cdi: real("cdi").notNull().default(0),
  borough: text("borough"),
  cdiBreakdown: jsonb("cdi_breakdown"),
  trend: varchar("trend", { length: 8 }).notNull().default("flat"),
  raw: jsonb("raw"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  transitStops500m: integer("transit_stops_500m").notNull().default(0),
  poiLibraries: integer("poi_libraries").notNull().default(0),
  poiCommunityCentres: integer("poi_community_centres").notNull().default(0),
  poiParks: integer("poi_parks").notNull().default(0),
  poiBenches: integer("poi_benches").notNull().default(0),
  poiCafes: integer("poi_cafes").notNull().default(0),
  poiSports: integer("poi_sports").notNull().default(0),
  poiIntersections: integer("poi_intersections").notNull().default(0),
});

export const interventions = pgTable("interventions", {
  id: text("id").primaryKey(),
  neighbourhoodId: text("neighbourhood_id").notNull(),
  rationale: text("rationale").notNull(),
  strategy: jsonb("strategy").notNull(),
  predictedScoreGain: real("predicted_score_gain").notNull().default(0),
  predictedConnections: integer("predicted_connections").notNull().default(0),
  costPerConnectionEUR: real("cost_per_connection_eur").notNull().default(0),
  weeks: jsonb("weeks").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: text("id").primaryKey(),
  neighbourhoodId: text("neighbourhood_id").notNull(),
  interventionId: text("intervention_id"),
  shockText: text("shock_text"),
  channels: jsonb("channels").notNull(),
  clusters: jsonb("clusters").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  outcomes: jsonb("outcomes"),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const clusterMessages = pgTable("cluster_messages", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id"),
  interventionId: text("intervention_id").notNull(),
  clusterId: text("cluster_id").notNull(),
  channel: varchar("channel", { length: 16 }).notNull(),
  language: varchar("language", { length: 8 }).notNull().default("nl"),
  tone: text("tone"),
  message: text("message").notNull(),
  pdfUrl: text("pdf_url"),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentRuns = pgTable("agent_runs", {
  id: text("id").primaryKey(),
  interventionId: text("intervention_id"),
  neighbourhoodId: text("neighbourhood_id").notNull(),
  steps: jsonb("steps").notNull(),
  totalMs: integer("total_ms").notNull().default(0),
  ok: boolean("ok").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scoreHistory = pgTable("score_history", {
  id: text("id").primaryKey(),
  neighbourhoodId: text("neighbourhood_id").notNull(),
  score: real("score").notNull(),
  weatherIsolation: real("weather_isolation"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Neighbourhood = typeof neighbourhoods.$inferSelect;
export type NeighbourhoodInsert = typeof neighbourhoods.$inferInsert;
export type Intervention = typeof interventions.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type ClusterMessageRow = typeof clusterMessages.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;

// === Memory / RAG knowledge graph ===
export const memories = pgTable("memories", {
  id: text("id").primaryKey(),
  containerTag: text("container_tag").notNull(),
  kind: text("kind").notNull().default("profile"),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chunks = pgTable("chunks", {
  id: text("id").primaryKey(),
  memoryId: text("memory_id").notNull(),
  containerTag: text("container_tag").notNull(),
  position: integer("position").notNull(),
  content: text("content").notNull(),
  // embedding is vector(3072); managed via raw SQL since drizzle-orm 0.45 lacks a typed vector column for 3072 dims
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const entities = pgTable("entities", {
  id: text("id").primaryKey(),
  containerTag: text("container_tag").notNull(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const edges = pgTable("edges", {
  id: text("id").primaryKey(),
  containerTag: text("container_tag").notNull(),
  sourceEntity: text("source_entity").notNull(),
  targetEntity: text("target_entity").notNull(),
  relation: text("relation").notNull(),
  weight: real("weight").notNull().default(1),
  sourceMemoryId: text("source_memory_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Memory = typeof memories.$inferSelect;
export type ChunkRow = typeof chunks.$inferSelect;
export type Entity = typeof entities.$inferSelect;
export type EdgeRow = typeof edges.$inferSelect;
