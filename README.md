# IRUSA Smart Event & Donor Intelligence Dashboard

A web app built for **Islamic Relief USA** that replaces the patchwork of spreadsheets they use for event management, donor tracking, FRF reconciliation, and outreach with a single, AI-powered platform.

Built for HackMSA 2026.

---

## The Problem

IRUSA's regional teams currently track everything — events, attendees, donations, FRFs (Fundraising Report Forms), donor history — across disconnected Google Sheets and Excel files. That makes it hard to:

- See the full picture of any donor or event in one place
- Catch missing FRFs, mismatched revenue, or lapsed donors before they become problems
- Personalize outreach at scale (every thank-you and re-engagement email is hand-written)
- Onboard new staff without a spreadsheet treasure hunt

## What It Does

- **Smart Dashboard** — KPIs (total raised, donor count, upcoming events, action items) plus a live alerts feed that flags missing FRFs, mismatched revenue, lapsed major donors, and unusual transactions.
- **AI-Powered Spreadsheet Import** — drop in *any* CSV or Excel file (donors, donations, events, or a mix) and the system uses AI to map every column to the right field, then commits in one click. No fixed templates.
- **Event Management** — create events, log attendance, track revenue, and reconcile FRFs against actual collected revenue (mismatches surface as alerts).
- **Donor Intelligence** — full giving history, tier classification (one-time / recurring / major / seasonal / lapsed), top causes, and a "Suggested Actions" panel with AI-recommended outreach for each donor.
- **Auto-Generated, Cause-Aware Follow-Ups** — the system continuously scans donor signals (last gift date, lifetime total, top cause) and generates personalized follow-up tasks: thank-yous, re-engagement asks, stewardship calls, and event invites that match the donor's giving history.
- **Personalized Email Drafts** — every follow-up ships with a multi-paragraph email that greets the donor by name and references their actual giving history (cause, gift count, lifetime amount, last donation date). One click opens it in the staff member's mail client.
- **Unified Tasks Page** — every open follow-up and data alert across the org in one filterable list, sorted by due date with overdue items in red.
- **Reports** — revenue by event, donor conversion funnels, FRF reconciliation status, and cause-interest breakdowns.

## Tech Stack

- **Frontend:** React + Vite + TypeScript, Tailwind, shadcn/ui, wouter, TanStack Query
- **Backend:** Node.js + Express, OpenAPI-generated client
- **Database:** PostgreSQL via Drizzle ORM
- **AI:** OpenAI (sheet column mapping, recommendation generation)
- **Monorepo:** pnpm workspaces

## Project Structure

```
artifacts/
  api-server/         Express API (port 8080)
  irusa-dashboard/    React frontend
lib/
  db/                 Drizzle schema + client
  api-spec/           OpenAPI source of truth
  api-client-react/   Generated React Query hooks
  api-zod/            Generated Zod request validators
```

## Running Locally

Install:
```bash
pnpm install
```

Push the database schema (uses the `DATABASE_URL` env var):
```bash
pnpm --filter @workspace/db push
```

Start everything (in separate terminals or via the workspace runner):
```bash
pnpm --filter @workspace/api-server dev
pnpm --filter @workspace/irusa-dashboard dev
```

Frontend runs on the workspace's assigned port; API runs on **8080**.

## Demo Highlights

Two flagship moments from the hackathon demo:

1. **Drop a messy spreadsheet, get clean data** — the included sample (`attached_assets/demo-imports/IRUSA_Donor_Intake_2026.csv`) has real-world-style messy headers ("Donor Full Name", "$ Amount", "Pmt Method", "Fund / Cause"). The AI correctly maps every column on first try.
2. **Personalized cause-aware outreach** — open *Maryam Siddiqui* (`/donors/8`). Her open follow-up is titled *"Upgrade ask for recurring orphan-support donor Maryam Siddiqui"* and the email body name-checks her cause, gift count, and lifetime total. Nothing is hand-written; everything is derived from her donation history.

## Built By

HackMSA 2026 team.
