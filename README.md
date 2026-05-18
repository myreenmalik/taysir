# Taysir — تيسير

**An AI-powered dashboard built for Islamic Relief USA — replacing spreadsheet chaos with one connected platform for events, donors, and FRFs.**

Built for HackMSA 2026.

🌐 **Live demo:** [islamic-relief-web.replit.app](https://islamic-relief-web.replit.app)

---

## Inspiration

Islamic Relief USA raises millions of dollars every year for people in crisis — Gaza, Lebanon, Sudan, Pakistan. But behind every campaign, the team is buried in spreadsheets. Event lists in one sheet, donations in another, FRFs reconciled by hand, donor history scattered across email threads.

We talked to people who've worked at IRUSA and kept hearing the same thing: *"We spend more time fixing systems than helping people."* That stuck with us. We wanted to build something that gave that time back — and built it specifically for the way IRUSA actually works, not a generic CRM forced on top of them.

## What It Does

**Taysir** (Arabic for *ease*) is a centralized dashboard that replaces the spreadsheet chaos with one connected platform. It does four things:

- **Effortless onboarding** — drop in any existing IRUSA spreadsheet and AI maps the columns automatically. No retyping years of data.
- **Event & funding operations** — events, donations, attendees, and FRF reconciliation all in one workflow.
- **Donor intelligence** — every donor has a full profile with giving history, cause preferences, and AI-generated personalized follow-up emails (no more "Dear Friend").
- **Smart alerts & tasks** — the system continuously flags missing FRFs, lapsed donors, and revenue mismatches before they become problems.

## How We Built It

Full-stack TypeScript app:

- **Frontend:** React + Vite + Tailwind CSS + shadcn/ui for the dashboard
- **Backend:** Node.js with Express for the API server
- **Database:** PostgreSQL with Drizzle ORM
- **AI:** OpenAI for the two flagship features — CSV column mapping during import, and personalized donor outreach emails

## Challenges We Ran Into

- **Designing for a real organization, not a generic demo.** IRUSA has specific workflows — FRFs, masjid partnerships, campaign-based fundraising — and we had to learn the vocabulary before we could build for it.
- **Making the AI feel useful, not gimmicky.** Anyone can bolt ChatGPT onto a form. Getting it to actually map messy spreadsheet columns reliably, and to write donor emails that sound human and culturally aware, took real iteration.
- **Scope discipline.** We had ideas for masjid ranking, predictive donor scoring, mobile apps — we cut all of it to make sure the four pillars we promised actually worked end-to-end on stage.

## Accomplishments We're Proud Of

- The **AI CSV importer actually works on real, messy spreadsheets** — not just clean demo data.
- The **personalized donor email** opens with *As-salamu alaykum* and references the donor's actual giving history. It's the kind of thing that takes a staff member 20 minutes to write by hand.
- We built a **complete pitch experience** — dashboard, API, branded slide deck, README, GitHub repo — not just a prototype.
- The product is **named, branded, and rooted in a real cultural value** (تيسير — ease) rather than another generic SaaS name.

## What We Learned

- **Onboarding is the moat.** A tool that requires a 6-month migration will never get adopted. AI-assisted import is what makes Taysir realistic.
- **Cultural specificity is a feature, not a flourish.** The Arabic name, the greeting in the email, the typography choices — these signal to IRUSA that we built for them in particular.
- **A shippable v1 beats an ambitious v3.** Cutting features we couldn't demo well was the best decision we made.

## What's Next for Taysir

- **Pilot with one IRUSA campaign team** — measure real hours saved per week.
- **Expand AI outreach** to multi-step donor journeys (welcome series, re-engagement, major-gift cultivation).
- **Build the masjid intelligence layer** — ranking partner masjids by ROI, attendance, and campaign fit.
- **Add role-based access** so volunteers, campaign managers, and finance staff each see what they need.
- **Mobile companion app** for event-day check-in and on-site donation capture.
- **Deeper financial integration** — direct sync with IRUSA's accounting system to eliminate manual FRF entry entirely.

---

## Built With

- **TypeScript** — primary language across frontend and backend
- **React** + **Vite** — frontend
- **Tailwind CSS** + **shadcn/ui** — design system
- **Express.js** (Node.js) — API server
- **PostgreSQL** + **Drizzle ORM** — database
- **OpenAI API** — AI-powered CSV mapping & personalized donor emails
- **HTML / CSS**
- **SQL**
- **Replit** — development & deployment

## Try It Out

🌐 [islamic-relief-web.replit.app](https://islamic-relief-web.replit.app)

## Project Structure

```
artifacts/
├── irusa-dashboard/   # Main Taysir dashboard (React + Vite)
├── api-server/        # Express API + OpenAI integrations
├── irusa-pitch/       # Branded pitch deck
└── mockup-sandbox/    # Component preview environment
packages/
├── db/                # Drizzle schema & database client
└── ...                # Shared TypeScript libraries
```

## Running Locally

```
cp .env.example .env
# fill in your values, then:
pnpm install
pnpm dev
```
