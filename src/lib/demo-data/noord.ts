import type { DemoSnapshot } from "./types";

// ─── Noord (Amsterdam) sample run ──────────────────────────────────────────────
// Hand-written sample that shows the intervention flow when the app runs
// without a database or API keys (static snapshot mode) or with `?demo=1`.
// It was NOT produced by the agents: the events, venues, clusters and
// estimates below are illustrative examples, and the UI labels it as such.
// ───────────────────────────────────────────────────────────────────────────────

const NEIGHBOURHOOD_ID = "noord_AM_demo";
const BUURT_NAME = "Banne Buiksloot";

const CLUSTERS = [
  {
    id: "cluster_elderly",
    profile: "Dutch elderly 65+, long-term residents (Vogelbuurt, Tuindorp Oostzaan)",
    ageRange: [65, 85] as [number, number],
    digitalLiteracy: "low" as const,
    preferredChannel: "leaflet" as const,
    language: ["nl"],
    estimatedSize: 1840,
    notes: "Sees the neighbourhood as changing too fast; trusts buurthuis and gemeente.",
  },
  {
    id: "cluster_young_adults",
    profile: "Young creatives 25-35, NDSM and Noord-IJplein",
    ageRange: [25, 35] as [number, number],
    digitalLiteracy: "high" as const,
    preferredChannel: "instagram" as const,
    language: ["nl", "en"],
    estimatedSize: 2210,
    notes: "Recently moved, working in design or media, low embedded social network.",
  },
  {
    id: "cluster_low_income",
    profile: "Migrant families with school-age children, Banne Buiksloot",
    ageRange: [28, 55] as [number, number],
    digitalLiteracy: "medium" as const,
    preferredChannel: "whatsapp" as const,
    language: ["nl", "ar", "tr"],
    estimatedSize: 1490,
    notes: "Strong intra-community ties, weaker bridges to other clusters; WhatsApp dominant.",
  },
];

const ACTIVITIES = [
  {
    name: "Buurttuin koffieochtend",
    description:
      "Inloop-koffieochtend in de buurttuin met vers gebak. Geen aanmelding nodig, gewoon langskomen.",
    venue: "Buurttuin Vogelbuurt, Meeuwenlaan 78",
    whenISO: futureISO(3, 10, 30),
    targetClusters: ["cluster_elderly"],
  },
  {
    name: "NDSM Sunday Print Market",
    description:
      "Local print and zine market with neighbours selling their own work. Free entry, coffee from De Ceuvel.",
    venue: "NDSM Loods, TT. Neveritaweg 15",
    whenISO: futureISO(5, 13, 0),
    targetClusters: ["cluster_young_adults"],
  },
  {
    name: "Familie-kookmiddag bij De Bovenkamer",
    description:
      "Samen koken voor families uit de buurt. Kinderen welkom. Halal en vegetarisch beschikbaar.",
    venue: "Buurthuis De Bovenkamer, Buikslotermeerplein 137",
    whenISO: futureISO(6, 16, 0),
    targetClusters: ["cluster_low_income", "cluster_elderly"],
  },
  {
    name: "Plantenruil Noorderpark",
    description:
      "Breng een plant, neem een plant. Laagdrempelig samenkomen tussen buurtgenoten in het park.",
    venue: "Noorderpark Theehuis, Sneeuwbalweg 12",
    whenISO: futureISO(8, 11, 0),
    targetClusters: ["cluster_young_adults", "cluster_low_income"],
  },
];

const STRATEGY = {
  neighbourhoodId: NEIGHBOURHOOD_ID,
  rationale:
    "Sample rationale: the three clusters rarely meet without an occasion, so the strategy pairs a low-friction daytime ritual for older long-term residents with cross-cluster activities that younger movers and families can self-select into.",
  activities: ACTIVITIES,
  clusters: CLUSTERS,
  predictedScoreGain: 14,
  predictedConnections: 47,
  costPerConnectionEUR: 395,
  weeks: [
    { week: 1, score: 58 },
    { week: 2, score: 61 },
    { week: 3, score: 65 },
    { week: 4, score: 68 },
    { week: 5, score: 70 },
    { week: 6, score: 72 },
  ],
};

const MESSAGES = [
  {
    clusterId: "cluster_elderly",
    channel: "leaflet" as const,
    language: "nl",
    tone: "Warm, vertrouwd, niet betuttelend",
    message:
      "Mevrouw, meneer — woensdag is er koffie en gebak in de buurttuin aan de Meeuwenlaan. Iedereen uit de buurt is welkom, geen aanmelding. Vanaf 10:30. Een paar buurtgenoten komen ook. Tot dan?",
  },
  {
    clusterId: "cluster_young_adults",
    channel: "instagram" as const,
    language: "en",
    tone: "Casual, in-the-know, slightly understated",
    message:
      "Print market at NDSM Loods this Sunday — neighbours selling zines, prints, the usual chaos. Free coffee from De Ceuvel. Bring something or just come look. 13:00 onwards.",
  },
  {
    clusterId: "cluster_low_income",
    channel: "whatsapp" as const,
    language: "nl",
    tone: "Vriendelijk, inclusief, familiegericht",
    message:
      "Hoi buren! Donderdag samen koken bij De Bovenkamer aan het Buikslotermeerplein. Halal en vegetarisch, kinderen zijn welkom. We zien jullie graag, 16:00. Geen kosten.",
  },
];

// Compose the SSE event stream as it would have come off /api/simulate.
const STREAM = [
  { delayMs: 200, event: { type: "info", key: "buurt", value: BUURT_NAME } as const },

  // s1: neighbourhood memory
  {
    delayMs: 250,
    event: { type: "step", id: "s1", label: "Retrieving neighbourhood memory", status: "active" } as const,
  },
  {
    delayMs: 1500,
    event: {
      type: "step",
      id: "s1",
      label: "Retrieving neighbourhood memory",
      status: "completed",
      detail: "sample run: no memory lookup",
    } as const,
  },

  // s2: Web search
  {
    delayMs: 350,
    event: { type: "step", id: "s2", label: "Searching local events in Noord", status: "active" } as const,
  },
  {
    delayMs: 3800,
    event: {
      type: "step",
      id: "s2",
      label: "Searching local events in Noord",
      status: "completed",
      detail: "sample run: 4 example events, not from a live search",
    } as const,
  },

  // s3: Clusters
  {
    delayMs: 300,
    event: { type: "step", id: "s3", label: "Identifying resident clusters", status: "active" } as const,
  },
  {
    delayMs: 1600,
    event: {
      type: "step",
      id: "s3",
      label: "Identifying resident clusters",
      status: "completed",
      detail: "Dutch elderly 65+ · Young creatives 25-35 · Migrant families with school-age children",
    } as const,
  },

  // s4: Strategy
  {
    delayMs: 300,
    event: {
      type: "step",
      id: "s4",
      label: "Generating bespoke intervention strategy",
      status: "active",
    } as const,
  },
  {
    delayMs: 5400,
    event: {
      type: "step",
      id: "s4",
      label: "Generating bespoke intervention strategy",
      status: "completed",
      detail: "sample run: 4 activities, example estimates",
    } as const,
  },
  { delayMs: 80, event: { type: "strategy", strategy: STRATEGY } as const },

  // s5: Personalisation — interleave cluster_message events as they stream
  {
    delayMs: 250,
    event: { type: "step", id: "s5", label: "Personalising messages per cluster", status: "active" } as const,
  },
  { delayMs: 1700, event: { type: "cluster_message", message: MESSAGES[0] } as const },
  { delayMs: 1300, event: { type: "cluster_message", message: MESSAGES[1] } as const },
  { delayMs: 1500, event: { type: "cluster_message", message: MESSAGES[2] } as const },
  {
    delayMs: 350,
    event: {
      type: "step",
      id: "s5",
      label: "Personalising messages per cluster",
      status: "completed",
      detail: "3 sample messages",
    } as const,
  },

  // s6: Store
  {
    delayMs: 200,
    event: { type: "step", id: "s6", label: "Storing strategy and messages", status: "active" } as const,
  },
  {
    delayMs: 900,
    event: {
      type: "step",
      id: "s6",
      label: "Storing strategy and messages",
      status: "skipped",
      detail: "sample run: nothing stored",
    } as const,
  },

  // s7: Stream
  {
    delayMs: 200,
    event: { type: "step", id: "s7", label: "Streaming results to dashboard", status: "active" } as const,
  },
  {
    delayMs: 400,
    event: {
      type: "step",
      id: "s7",
      label: "Streaming results to dashboard",
      status: "completed",
      detail: "3 previews",
    } as const,
  },

  { delayMs: 120, event: { type: "done" } as const },
];

export const NOORD_SNAPSHOT: DemoSnapshot = {
  borough: "Noord",
  city: "amsterdam",
  provenance: {
    kind: "illustrative",
    note: "Hand-written sample showing the flow; not produced by the agents.",
  },
  stream: STREAM,
};

function futureISO(daysAhead: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
