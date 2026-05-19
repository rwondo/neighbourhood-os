import OpenAI, { APIError } from "openai";
import { makeLogger } from "@/lib/log";
import type { BuurtRecord, RecommendedActivity } from "@/lib/types";

const log = makeLogger("agent:web-search");

const cityLabel = (city: string): string => {
  if (city === "rotterdam") return "Rotterdam";
  if (city === "amsterdam") return "Amsterdam";
  if (city === "denhaag") return "Den Haag";
  return city;
};

// Hosts known to publish scheduled event listings. URLs from these hosts pass
// the filter without further checks (they're aggregators / calendars by
// design). For hosts NOT on this list, the URL's path must look like an event
// page (see EVENT_PATH).
const TRUSTED_EVENT_HOSTS: RegExp[] = [
  /(^|\.)eventbrite\.(com|nl)$/i,
  /(^|\.)meetup\.com$/i,
  /(^|\.)facebook\.com\/events?\b/i,
  /(^|\.)rotterdam\.nl$/i,
  /(^|\.)amsterdam\.nl$/i,
  /(^|\.)denhaag\.nl$/i,
  /(^|\.)bibliotheek\.(rotterdam|amsterdam|denhaag)\.nl$/i,
  /(^|\.)oba\.nl$/i,
  /(^|\.)bibliotheekrotterdam\.nl$/i,
  /(^|\.)bibliotheekdenhaag\.nl$/i,
  /(^|\.)wijkcentrum.*\.nl$/i,
  /(^|\.)buurthuis.*\.nl$/i,
  /(^|\.)uitagenda.*\.nl$/i,
  /(^|\.)010nu\.nl$/i,
  /(^|\.)indebuurt\.nl$/i,
  /(^|\.)rotterdampas\.nl$/i,
  /(^|\.)iamsterdam\.com$/i,
  /(^|\.)vvvdenhaag\.com$/i,
  /(^|\.)ticketmaster\.nl$/i,
  /(^|\.)uitburo\.nl$/i,
  /(^|\.)uit\.nl$/i,
  /(^|\.)nl\.allevents\.in$/i,
  /(^|\.)allevents\.in$/i,
  /(^|\.)vrijwilligerswerk(rotterdam|amsterdam|denhaag)?\.nl$/i,
  /(^|\.)kbo-pcob\.nl$/i,
  /(^|\.)anbo\.nl$/i,
];

// URL path tokens that signal "this is an event page" rather than a venue
// homepage / about page / contact page.
const EVENT_PATH = /\/(events?|agenda|activiteit(en)?|programma(s)?|workshop(s)?|cursus(en)?|meetup|evenement(en)?|kalender|tickets?|e|act|gebeurtenis|festival|voorstelling|optreden|concert|exhibition|tentoonstelling|ontmoeting|borrel|matinee)(\/|$|\?)/i;

const VENUE_HOMEPAGE_PATH = /^\/?(en|nl)?\/?(contact|about|over-ons|over|info|home|index(\.html?)?|locatie|adres|openingstijden)?\/?$/i;

function parseUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function hostOfUrl(u: URL): string {
  return u.hostname.replace(/^www\./, "");
}

// Real-event URL: must look like a scheduled event listing, not a venue
// homepage. We accept either a trusted host OR a URL path with event-y tokens.
function isRealEventUrl(u: URL): boolean {
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname;
  const path = u.pathname || "/";
  // Reject obvious non-event pages even on trusted hosts.
  if (VENUE_HOMEPAGE_PATH.test(path) && !TRUSTED_EVENT_HOSTS.some((rx) => rx.test(host + path))) {
    return false;
  }
  // Trusted aggregators / calendars: accept anything past the homepage.
  if (TRUSTED_EVENT_HOSTS.some((rx) => rx.test(host) || rx.test(host + path))) {
    return path !== "/" && !VENUE_HOMEPAGE_PATH.test(path);
  }
  // Anywhere else: path must contain an event-listing keyword.
  return EVENT_PATH.test(path);
}

// ── Real web search via OpenAI's responses + web_search_preview tool ──
//
// Returns activities that have a real cited event-page URL. Activities without
// a URL (or with a URL from an untrusted host) are dropped — we refuse to
// surface a fabricated event built from a venue's homepage.

const OPENAI_SEARCH_MODEL = process.env.OPENAI_SEARCH_MODEL ?? "gpt-4o-mini";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      annotations?: Array<{ type?: string; url?: string; title?: string; start_index?: number; end_index?: number }>;
    }>;
  }>;
};

type SearchScope = { label: string; instruction: string };

async function realWebSearch(
  neighbourhood: BuurtRecord,
  scope: SearchScope,
  monthLabel: string,
): Promise<RecommendedActivity[] | null> {
  if (!process.env.OPENAI_API_KEY) {
    log.warn("OPENAI_API_KEY not set — skipping live web search");
    return null;
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const city = cityLabel(neighbourhood.city);
  const today = new Date().toISOString().slice(0, 10);
  const input = `You are searching for REAL, SCHEDULED community events ${scope.instruction}, Netherlands during ${monthLabel}.

CRITICAL — what counts as a real event:
- It is published on a public listing page (Eventbrite, Meetup, the gemeente's activiteiten page, a wijkcentrum / bibliotheek / buurthuis programme, indebuurt.nl, uitagenda, ticketmaster, allevents, rotterdampas, iamsterdam, uit.nl) with an explicit calendar date.
- The page describes a specific scheduled occurrence, not a venue's general hours.
- The URL points at the event itself (e.g. /agenda/koffieochtend-2026-05-22, /e/chess-night-12345, /events/repair-cafe-juni) — NOT the venue's homepage or /contact / /about.

What is NOT a real event:
- "Café X exists, so people can hang out there." This is fabrication. DO NOT do this.
- A venue's homepage with no event date. DO NOT use these.
- A general "this neighbourhood has libraries" description.

Today's date is ${today}. Return AS MANY real events as you can find — aim for 10-15 — in STRICT JSON only (no prose, no markdown):
{ "activities": [
  { "name": "exact event title from the listing",
    "description": "one sentence in Dutch or English",
    "venue": "real venue name from the listing",
    "whenISO": "ISO8601 datetime STRICTLY AFTER ${today} and within the next 21 days",
    "url": "https://… link to the event listing page (NOT just the venue homepage)",
    "source": "host site name, e.g. 'eventbrite.nl', 'rotterdam.nl', 'bibliotheek.rotterdam.nl'" }
] }

Constraints:
- Every activity MUST have a "url" that points to the event's listing page. If you cannot find one, omit that activity. Better to return fewer activities than to invent.
- Demographically diverse mix: cover elderly (chess, koffieochtend, walking groups, language café, ANBO/KBO meetings), working-age adults (board games, cooking workshops, repair cafés, taalcafé, sportclubs, lezingen), parents and young adults (run clubs, creative workshops, community gardens, kindervoorstellingen, makerspaces, museum talks).
- Activity-framed only. Never mention loneliness, isolation, or mental health.
- Every whenISO must be in the future. Do not invent dates.
- Aim for QUANTITY of real listings — it is fine to return 10+ events. Variety helps the demo.`;

  const started = Date.now();
  log.info("openai web_search_preview start", {
    model: OPENAI_SEARCH_MODEL,
    buurt: neighbourhood.name,
    scope: scope.label,
    city: neighbourhood.city,
  });
  try {
    type RequestBody = {
      model: string;
      input: string;
      tools: Array<{ type: "web_search_preview" }>;
      temperature?: number;
    };
    const response = (await (
      openai as unknown as { responses: { create: (b: RequestBody) => Promise<OpenAIResponse> } }
    ).responses.create({
      model: OPENAI_SEARCH_MODEL,
      input,
      tools: [{ type: "web_search_preview" }],
      // Nudge toward deterministic output; combined with the day-bucket cache
      // (see searchLocalActivities) this means a borough's activity list is
      // stable across repeat clicks within a session.
      temperature: 0,
    })) as OpenAIResponse;

    const text = response.output_text ?? "";
    // Collect cited URLs from annotations (the model often emits them only here).
    const annotatedUrls: string[] = [];
    for (const block of response.output ?? []) {
      for (const piece of block.content ?? []) {
        for (const ann of piece.annotations ?? []) {
          if (ann.type === "url_citation" && ann.url) annotatedUrls.push(ann.url);
        }
      }
    }
    log.info("openai web_search_preview ← ok", {
      ms: Date.now() - started,
      textChars: text.length,
      citedUrls: annotatedUrls.length,
    });

    const match = text.match(/\{[\s\S]*"activities"[\s\S]*\}/);
    if (!match) {
      log.warn("web_search_preview returned no JSON object — dropping result");
      return null;
    }
    const parsed = JSON.parse(match[0]) as { activities?: unknown };
    if (!Array.isArray(parsed.activities)) return null;

    const candidates: RecommendedActivity[] = [];
    parsed.activities.slice(0, 20).forEach((raw, idx) => {
      const a = raw as Partial<RecommendedActivity>;
      // Take URL from `url` first, then `source` (some models put it there), then annotations.
      const urlObj =
        parseUrl(a.url) ?? parseUrl(a.source) ?? parseUrl(annotatedUrls[idx]);
      if (!urlObj || !isRealEventUrl(urlObj)) {
        log.info("dropping activity without real event URL", {
          name: a.name,
          rawUrl: a.url ?? a.source ?? annotatedUrls[idx] ?? null,
        });
        return;
      }
      candidates.push({
        name: String(a.name ?? "Local event").trim(),
        description: String(a.description ?? "").trim(),
        venue: String(a.venue ?? "").trim(),
        whenISO: typeof a.whenISO === "string" ? a.whenISO : "",
        url: urlObj.toString(),
        source: hostOfUrl(urlObj),
      });
    });

    if (candidates.length === 0) {
      log.warn("web search returned no URL-backed events", { scope: scope.label });
      return null;
    }
    log.info("web search candidates", { scope: scope.label, kept: candidates.length });
    return candidates;
  } catch (err) {
    if (err instanceof APIError) {
      log.warn("OpenAI web_search_preview API error", {
        status: err.status,
        code: err.code,
        type: err.type,
        message: err.message,
        body: (err as APIError & { error?: unknown }).error,
      });
    } else {
      log.warn("OpenAI web_search_preview threw", err);
    }
    return null;
  }
}

// ── Composite searcher ──
//
// Only the live web search path runs. The LLM "suggest" tier and the hardcoded
// template tier are gone — both produced fabricated events that the user
// rejected. When a borough is sparsely served (Prins Alexander is the
// canonical example: residential, few public event listings), we run a second
// pass at city scope and merge, so the dashboard still has a useful shortlist
// rather than a single event.
//
// Determinism: the OpenAI web_search_preview tool is non-deterministic — it
// hits live web pages and the model picks different events each run. We cache
// the search result for 6 hours so repeat clicks on the same borough return
// the same activity list, which is what users expect.

type SearchResult = {
  activities: RecommendedActivity[];
  source: "borough" | "borough+city" | "city" | "none";
};

type CachedSearch = SearchResult & {
  cachedAt: number;
};

const MIN_BOROUGH_EVENTS = 4;
const MAX_TOTAL_EVENTS = 12;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Module-level (process-wide) cache. In dev a HMR reload clears it; in prod a
// new instance starts cold. That's fine — the cache is for repeat clicks
// within a session, not durable storage.
const SEARCH_CACHE = new Map<string, CachedSearch>();
// In-flight request dedup: concurrent calls for the same key share one promise
// instead of hammering OpenAI in parallel.
const INFLIGHT = new Map<string, Promise<SearchResult>>();

function cacheKey(city: string, borough: string | null): string {
  const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return `${city}__${borough ?? "no-borough"}__d${day}`;
}

function dedupeByUrl(activities: RecommendedActivity[]): RecommendedActivity[] {
  const seen = new Set<string>();
  const out: RecommendedActivity[] = [];
  for (const a of activities) {
    const key = a.url ?? `${a.name}__${a.venue}__${a.whenISO}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

async function runSearchPipeline(
  neighbourhood: BuurtRecord,
  borough: string | null,
): Promise<SearchResult> {
  const monthLabel = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const city = cityLabel(neighbourhood.city);

  const boroughScope: SearchScope | null = borough
    ? {
        label: `borough:${borough}`,
        instruction: `inside the stadsdeel/gebied "${borough}" of ${city} (the buurt "${neighbourhood.name}" is part of this borough — only events within this borough's boundaries)`,
      }
    : null;
  const cityScope: SearchScope = {
    label: `city:${neighbourhood.city}`,
    instruction: `anywhere in ${city}${borough ? `, especially close to the "${borough}" borough` : ""} — prefer venues within ~3 km of ${neighbourhood.name}`,
  };

  // Pass 1: borough-scoped (when we have a borough name).
  const boroughHits = boroughScope
    ? ((await realWebSearch(neighbourhood, boroughScope, monthLabel)) ?? [])
    : [];

  if (boroughHits.length >= MIN_BOROUGH_EVENTS) {
    log.info("borough search produced enough events", { count: boroughHits.length });
    return { activities: boroughHits.slice(0, MAX_TOTAL_EVENTS), source: "borough" };
  }

  // Pass 2: city-wide top-up. Used both when the borough was sparse and when
  // we never had a borough name (worst-CDI buurt outside named gebieden).
  log.info("borough search sparse — running city-wide top-up", {
    boroughCount: boroughHits.length,
  });
  const cityHits = (await realWebSearch(neighbourhood, cityScope, monthLabel)) ?? [];

  const merged = dedupeByUrl([...boroughHits, ...cityHits]).slice(0, MAX_TOTAL_EVENTS);
  if (merged.length === 0) {
    log.warn("both borough and city-wide searches returned no real events");
    return { activities: [], source: "none" };
  }
  return {
    activities: merged,
    source: boroughHits.length > 0 ? "borough+city" : "city",
  };
}

export async function searchLocalActivities(
  neighbourhood: BuurtRecord,
  borough: string | null,
): Promise<SearchResult> {
  const key = cacheKey(neighbourhood.city, borough);
  const cached = SEARCH_CACHE.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    log.info("search cache HIT", {
      key,
      ageMs: Date.now() - cached.cachedAt,
      count: cached.activities.length,
      source: cached.source,
    });
    return { activities: cached.activities, source: cached.source };
  }
  if (cached) SEARCH_CACHE.delete(key);

  // Dedupe concurrent callers — two simultaneous clicks share one OpenAI call.
  const inflight = INFLIGHT.get(key);
  if (inflight) {
    log.info("search cache MISS (joining in-flight)", { key });
    return inflight;
  }

  log.info("search cache MISS", {
    key,
    buurt: neighbourhood.name,
    code: neighbourhood.buurtCode,
    borough,
    city: neighbourhood.city,
  });

  const promise = runSearchPipeline(neighbourhood, borough)
    .then((result) => {
      SEARCH_CACHE.set(key, { ...result, cachedAt: Date.now() });
      return result;
    })
    .finally(() => {
      INFLIGHT.delete(key);
    });
  INFLIGHT.set(key, promise);
  return promise;
}
