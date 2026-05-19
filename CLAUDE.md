@AGENTS.md
# Neighbourhood OS — CLAUDE.md

## Project Overview
Neighbourhood OS is an AI-powered municipal social cohesion platform built for the BCG
challenge "The Lonely City" at EurHackNL 2026. It identifies socially isolated neighbourhoods
using anonymous aggregate signals and engineers hyper-personalised connection opportunities
delivered via WhatsApp, SMS, TikTok ads, Meta ads, and physical leaflets.

Read PRD.txt for full product context before doing anything.

This is a hackathon demo — optimize for working demo quality, not production robustness.
No auth, no rate limiting, no edge cases needed.

## Stack
- Next.js 15 (App Router), TypeScript, Tailwind CSS
- shadcn/ui components (already configured)
- react-simple-maps for Netherlands wijk-level heatmap
- Recharts for impact projection charts
- Together AI (Kimi K2.6 orchestrator, DeepSeek R1 agents) via OpenAI-compatible SDK
- Supermemory for per-neighbourhood historical context
- Supabase (PostgreSQL) with Drizzle ORM
- MessageBird for SMS
- Meta Marketing API for Facebook/Instagram ads
- TikTok Ads API for young adult targeting
- Vercel for deployment

## Commands
- `pnpm dev` — start dev server
- `pnpm build` — production build, run to verify zero TS errors
- `pnpm lint` — ESLint check
- `pnpm db:push` — push Drizzle schema to Supabase
- `pnpm db:studio` — open Drizzle Studio

## Project Structure
- `src/app/` — App Router pages and API routes
- `src/app/api/simulate/route.ts` — main orchestrator endpoint
- `src/app/api/campaigns/route.ts` — campaign management
- `src/components/` — UI components
- `src/components/map/` — Netherlands wijk heatmap
- `src/components/dashboard/` — municipality dashboard panels
- `src/lib/agents/` — agent definitions and neighbourhood profiles
- `src/lib/db/` — Drizzle schema and client
- `src/lib/together.ts` — Together AI client (OpenAI-compatible)
- `src/lib/supermemory.ts` — Supermemory client
- `src/lib/types.ts` — shared TypeScript types

## Environment Variables
All in `.env` (not `.env.local`):
TOGETHER_AI_API_KEY=
SCALEWAY_API_KEY=
SUPERMEMORY_API_KEY=
OPENAI_API_KEY=
MESSAGEBIRD_API_KEY=
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

## Database — Drizzle ORM
Use Drizzle with Supabase PostgreSQL. Schema lives in `src/lib/db/schema.ts`.
Client in `src/lib/db/index.ts`. Always use `pnpm db:push` to sync schema.
Never use Supabase client directly for database queries — Drizzle only.

## AI Client — Together AI
Together AI is OpenAI-compatible. Use openai SDK with custom baseURL:
```typescript
import OpenAI from "openai"
export const together = new OpenAI({
  baseURL: "https://api.together.xyz/v1",
  apiKey: process.env.TOGETHER_AI_API_KEY,
})
// Orchestrator: "kimi-k2-6" 
// Agents: "deepseek-ai/DeepSeek-R1"
```
Always use `response_format: { type: "json_object" }` for agent calls.
Temperature 0.3 for agents, 0.5 for orchestrator.

## Code Style
- TypeScript strict mode — no `any`, ever
- Server components by default — `use client` only for hooks/browser APIs
- Tailwind only for styling — no inline styles, no CSS modules
- shadcn/ui for all primitives — never build buttons/inputs from scratch
- All API responses typed — interfaces in `src/lib/types.ts`

## Critical Rules
- NEVER add auth or login
- NEVER use `.env.local` — use `.env` only
- NEVER use Supabase client for DB queries — Drizzle only
- NEVER hardcode API keys
- Always run `pnpm build` before considering any feature done
- Demo must never crash — graceful fallbacks on all agent failures
- Stream agent results as they arrive via SSE — never wait for all to complete

## Three Target Cities
Rotterdam, Amsterdam, The Hague. CBS buurt data seeded for all three.
Municipality switcher in dashboard top left.

## Demo Scenarios (must work perfectly)
1. Crooswijk (Rotterdam) — high isolation, elderly cluster, chess afternoon intervention
2. Bijlmer (Amsterdam) — international student cluster, social event intervention  
3. Schilderswijk (The Hague) — mixed profile, multi-channel intervention

## What Matters for the Demo
1. Map loads with real social fabric scores per wijk
2. Click neighbourhood → orchestrator fires → agent trace streams live
3. Message previews appear per cluster with correct channel badges
4. Municipality switcher shows three different city profiles
5. Impact projection chart animates after strategy generates
6. No crashes, no blank states, no spinners that never resolve

