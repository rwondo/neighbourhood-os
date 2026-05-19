import type { DemoSnapshot } from "./types";

// ─── Noord (Amsterdam) demo snapshot ───────────────────────────────────────────
// Real Amsterdam-Noord buurt and venue references, plausibly Dutch event names
// and venue listings, three clusters matching the actual demographic mix
// (gentrifying creatives in NDSM, original Dutch working-class in Vogelbuurt,
// migrant families in Banne Buiksloot). Edit any field freely.
// To refresh from a live run, see `scripts/export-demo-snapshot.ts`.
// ───────────────────────────────────────────────────────────────────────────────

const NEIGHBOURHOOD_ID = "noord_AM_demo";
const BUURT_NAME = "Banne Buiksloot";
const BUURT_CODE = "BU03630601";

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
    url: "https://www.tolhuistuin.nl/agenda/buurttuin-koffieochtend",
    source: "tolhuistuin.nl",
    targetClusters: ["cluster_elderly"],
  },
  {
    name: "NDSM Sunday Print Market",
    description:
      "Local print and zine market with neighbours selling their own work. Free entry, coffee from De Ceuvel.",
    venue: "NDSM Loods, TT. Neveritaweg 15",
    whenISO: futureISO(5, 13, 0),
    url: "https://www.ndsm.nl/agenda/print-market-may",
    source: "ndsm.nl",
    targetClusters: ["cluster_young_adults"],
  },
  {
    name: "Familie-kookmiddag bij De Bovenkamer",
    description:
      "Samen koken voor families uit de buurt. Kinderen welkom. Halal en vegetarisch beschikbaar.",
    venue: "Buurthuis De Bovenkamer, Buikslotermeerplein 137",
    whenISO: futureISO(6, 16, 0),
    url: "https://www.amsterdam.nl/buurten/noord/agenda/familie-kookmiddag",
    source: "amsterdam.nl",
    targetClusters: ["cluster_low_income", "cluster_elderly"],
  },
  {
    name: "Plantenruil Noorderpark",
    description:
      "Breng een plant, neem een plant. Laagdrempelig samenkomen tussen buurtgenoten in het park.",
    venue: "Noorderpark Theehuis, Sneeuwbalweg 12",
    whenISO: futureISO(8, 11, 0),
    url: "https://www.noorderpark.nl/agenda/plantenruil",
    source: "noorderpark.nl",
    targetClusters: ["cluster_young_adults", "cluster_low_income"],
  },
];

const STRATEGY = {
  neighbourhoodId: NEIGHBOURHOOD_ID,
  rationale:
    "Banne Buiksloot crosses the threshold on three signals at once: 32% of residents live alone, 28% are 65+, and population turnover sits at 11% as NDSM development draws younger movers. The three clusters identified rarely meet without engineered occasions, so the strategy mixes a low-friction daytime ritual for elderly Dutch residents with two cross-cluster activities the migrant and creative groups can self-select into.",
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
  { delayMs: 60, event: { type: "info", key: "buurtCode", value: BUURT_CODE } as const },

  // s1: Supermemory
  {
    delayMs: 250,
    event: { type: "step", id: "s1", label: "Retrieving Supermemory context", status: "active" } as const,
  },
  {
    delayMs: 1500,
    event: {
      type: "step",
      id: "s1",
      label: "Retrieving Supermemory context",
      status: "completed",
      detail: "4 prior memories for Noord recovered",
    } as const,
  },

  // s2: Web search
  {
    delayMs: 350,
    event: { type: "step", id: "s2", label: "Scraping live events in Noord", status: "active" } as const,
  },
  {
    delayMs: 3800,
    event: {
      type: "step",
      id: "s2",
      label: "Scraping live events in Noord",
      status: "completed",
      detail: "4 URL-backed events · in Noord",
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
      detail: "4 activities · +14 social-fabric points (58 → 72 by week 6)",
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
      detail: "3 variants generated",
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
      status: "completed",
      detail: "Strategy and 3 message variants saved",
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
      detail: "3 previews · awaiting approval",
    } as const,
  },

  { delayMs: 120, event: { type: "done" } as const },
];

// Placeholder creative URLs. Swap with real Ideogram outputs for a tighter demo.
// Picsum is used so the demo works offline-ish on any network.
const CREATIVE_URL_INSTAGRAM = "https://picsum.photos/seed/noord-instagram/640/640";
const CREATIVE_URL_TIKTOK = "https://picsum.photos/seed/noord-tiktok/540/960";
const CREATIVE_URL_LEAFLET = "https://picsum.photos/seed/noord-leaflet/720/1280";

const ADS_MANAGER_META = "https://business.facebook.com/adsmanager/manage/campaigns?act=000000";
const ADS_MANAGER_TIKTOK = "https://ads.tiktok.com/i18n/perf/campaign?aadvid=0";

// Default fallback approval — used when an approved activity isn't found by name.
const DEFAULT_APPROVAL = {
  dispatchId: "disp_noord_demo_default",
  creatives: [
    {
      clusterId: "cluster_young_adults",
      channel: "instagram" as const,
      creativeUrl: CREATIVE_URL_INSTAGRAM,
      creativeStatus: "ready" as const,
      qrCodeUrl: null,
      joinUrl: null,
    },
    {
      clusterId: "cluster_low_income",
      channel: "whatsapp" as const,
      creativeUrl: null,
      creativeStatus: "ready" as const,
      qrCodeUrl: null,
      joinUrl: null,
    },
    {
      clusterId: "cluster_elderly",
      channel: "leaflet" as const,
      creativeUrl: CREATIVE_URL_LEAFLET,
      creativeStatus: "ready" as const,
      qrCodeUrl:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="#0f172a"><rect width="100" height="100" fill="#ffffff"/><g><rect x="10" y="10" width="20" height="20"/><rect x="70" y="10" width="20" height="20"/><rect x="10" y="70" width="20" height="20"/><rect x="40" y="40" width="8" height="8"/><rect x="55" y="40" width="8" height="8"/><rect x="40" y="55" width="8" height="8"/><rect x="55" y="55" width="8" height="8"/><rect x="70" y="55" width="20" height="8"/><rect x="40" y="70" width="8" height="20"/></g></svg>',
        ),
      joinUrl: "https://neighbourhoodos.nl/join/noord-elderly",
    },
  ],
  mcpResults: [
    {
      clusterId: "cluster_young_adults",
      channel: "instagram" as const,
      status: "live" as const,
      campaignId: "meta_noord_inst_4f2a9",
      adsManagerUrl: ADS_MANAGER_META,
      fallback: false,
    },
  ],
};

const APPROVAL_NDSM = {
  dispatchId: "disp_noord_ndsm",
  creatives: [
    {
      clusterId: "cluster_young_adults",
      channel: "instagram" as const,
      creativeUrl: CREATIVE_URL_INSTAGRAM,
      creativeStatus: "ready" as const,
      qrCodeUrl: null,
      joinUrl: null,
    },
    {
      clusterId: "cluster_young_adults",
      channel: "tiktok" as const,
      creativeUrl: CREATIVE_URL_TIKTOK,
      creativeStatus: "ready" as const,
      qrCodeUrl: null,
      joinUrl: null,
    },
  ],
  mcpResults: [
    {
      clusterId: "cluster_young_adults",
      channel: "instagram" as const,
      status: "live" as const,
      campaignId: "meta_noord_inst_4f2a9",
      adsManagerUrl: ADS_MANAGER_META,
      fallback: false,
    },
    {
      clusterId: "cluster_young_adults",
      channel: "tiktok" as const,
      status: "live" as const,
      campaignId: "tt_noord_b71c3",
      adsManagerUrl: ADS_MANAGER_TIKTOK,
      fallback: false,
    },
  ],
};

const APPROVAL_COFFEE = {
  dispatchId: "disp_noord_coffee",
  creatives: [
    {
      clusterId: "cluster_elderly",
      channel: "leaflet" as const,
      creativeUrl: CREATIVE_URL_LEAFLET,
      creativeStatus: "ready" as const,
      qrCodeUrl: DEFAULT_APPROVAL.creatives[2].qrCodeUrl,
      joinUrl: "https://neighbourhoodos.nl/join/noord-coffee",
    },
  ],
  mcpResults: [],
};

const APPROVAL_FAMILY = {
  dispatchId: "disp_noord_family",
  creatives: [
    {
      clusterId: "cluster_low_income",
      channel: "whatsapp" as const,
      creativeUrl: null,
      creativeStatus: "ready" as const,
      qrCodeUrl: null,
      joinUrl: null,
    },
    {
      clusterId: "cluster_elderly",
      channel: "leaflet" as const,
      creativeUrl: CREATIVE_URL_LEAFLET,
      creativeStatus: "ready" as const,
      qrCodeUrl: DEFAULT_APPROVAL.creatives[2].qrCodeUrl,
      joinUrl: "https://neighbourhoodos.nl/join/noord-family",
    },
  ],
  mcpResults: [],
};

export const NOORD_SNAPSHOT: DemoSnapshot = {
  borough: "Noord",
  city: "amsterdam",
  stream: STREAM,
  approval: {
    byActivityName: {
      "Buurttuin koffieochtend": APPROVAL_COFFEE,
      "NDSM Sunday Print Market": APPROVAL_NDSM,
      "Familie-kookmiddag bij De Bovenkamer": APPROVAL_FAMILY,
      "Plantenruil Noorderpark": DEFAULT_APPROVAL,
    },
    default: DEFAULT_APPROVAL,
  },
};

function futureISO(daysAhead: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
