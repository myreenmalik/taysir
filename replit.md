# IRUSA Smart Event & Donor Intelligence Dashboard

## Project Overview

A hackathon-ready web app for Islamic Relief USA that replaces messy spreadsheets with a centralized platform for:
- Event management with logistics tracking
- Donor intelligence with AI-driven outreach recommendations
- FRF (Fund Receipt Form) reconciliation (auto-reconciliation against revenue entries)
- Attendee tracking and segmentation
- Smart dashboard alerts
- Financial reporting and analytics

## Architecture

**Monorepo** (pnpm workspaces):
- `artifacts/irusa-dashboard` — React + Vite frontend (port from `PORT` env, preview path `/`)
- `artifacts/api-server` — Express API server (port 8080, preview path `/api`)
- `lib/db` — Drizzle ORM schema + migrations (PostgreSQL)
- `lib/api-spec` — OpenAPI spec + Orval codegen config
- `lib/api-zod` — Auto-generated Zod validators from OpenAPI spec
- `lib/api-client-react` — Auto-generated TanStack Query hooks

## Database Schema (9 tables)

| Table | Purpose |
|-------|---------|
| `events` | Core event records |
| `logistics_tasks` | Per-event task tracking |
| `revenue_entries` | Payment entries by type |
| `frf_records` | Fund Receipt Forms (auto-reconciled) |
| `allocations` | How revenue is allocated by cause |
| `attendees` | Event attendance + giving data |
| `donors` | Donor master records (auto-categorized) |
| `donations` | Individual donation records |
| `follow_up_tasks` | Post-event outreach tasks |

## Key Intelligence Features

- **Auto FRF Reconciliation**: When FRF is submitted, it's automatically compared to revenue entries. Status becomes `matched`, `mismatch`, or `pending`.
- **Auto Donor Categorization**: When donations are added/updated, donor category is computed: `one-time`, `seasonal`, `recurring`, `major` (>=$5k), `lapsed` (>1yr)
- **Smart Dashboard Alerts**: Surfaces missing FRFs, attendance gaps, FRF mismatches, lapsed donors, major donor outreach gaps, unusual amounts
- **AI Outreach Recommendations**: Per-donor recommendations based on personality type (Altruist/Investor/Repayer), giving history, top causes, recency

## Frontend Pages

- `/` — Dashboard (KPIs, alerts, top events, donor segments)
- `/events` — Events list (searchable/filterable)
- `/events/new` — New event form
- `/events/:id` — Event detail (tabs: Overview, Logistics, Revenue, FRF, Allocations, Attendees, Follow-Ups)
- `/donors` — Donors list (searchable, category/personality badges)
- `/donors/new` — New donor form
- `/donors/:id` — Donor profile (intelligence scores, top causes, AI recommendations)
- `/reports` — Analytics (Revenue by event, conversion rates, cause breakdown)

## Tech Stack

- **Frontend**: React 19, Vite, Wouter (routing), TanStack Query, Recharts, Tailwind CSS
- **Backend**: Express 5, TypeScript, Pino logging
- **Database**: PostgreSQL via Drizzle ORM
- **Codegen**: Orval (OpenAPI → Zod + TanStack Query)
- **Validation**: Zod v4

## Sample Data

Seeded with 10 realistic events, ~60 donors across all categories/tiers/personalities, ~140 donations (multi-year, ~40 event-linked), ~37 attendees, plus revenue entries, FRF records, allocations, logistics tasks, and follow-up tasks.

## Running Locally

Both workflows start automatically:
1. `artifacts/api-server: API Server` — builds and starts Express on PORT 8080
2. `artifacts/irusa-dashboard: web` — starts Vite dev server

### Seed scripts
- `pnpm --filter @workspace/api-server run seed:donors` — idempotently seeds donor mock data (donors keyed by email; seeded donations/attendees tagged `[seed:v1]` so re-runs replace only seeded rows). Recomputes donor stats via `recomputeDonorStats`.
- `pnpm --filter @workspace/api-server run backfill:donor-tiers` — recomputes category/tier/personality for every donor.

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (provisioned by Replit)
- `SESSION_SECRET` — Session secret (stored in Replit secrets)
- `PORT` — Assigned by Replit per artifact
