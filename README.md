# Genji Educator

A classroom rewards economy for one teacher and their students: award Dollars for behaviours, run a reward shop with two sealed currencies, and build quizzes that pay Gems — all with a security model that never trusts the browser.

![Stack](https://img.shields.io/badge/React_18-TypeScript-blue) ![Styled](https://img.shields.io/badge/TailwindCSS-3-38bdf8) ![Backend](https://img.shields.io/badge/Supabase-Postgres_·_Auth_·_RLS-3ecf8e)

## What it does

- **Behaviour economy** — tap-to-award Dollars (positive and negative behaviours, custom awards), every balance derived from an auditable ledger, undo everywhere.
- **Reward shop, two sealed currencies** — Dollars (earned from behaviours) and Gems (earned from quizzes) buy separate reward pools. There is no conversion in either direction, enforced in the database.
- **Quizzes** — multiple choice + true/false builder, CSV bulk import, per-student seeded shuffling, one attempt per student, server-side scoring, instant gem awarding, results with per-question analytics, archive/reopen.
- **Student portal** — PIN login, live dashboard (balance, gems to spend vs lifetime gems, goal ring, quizzes due), shop with affordability hints, quiz runner with autosave-and-resume.
- **Safety** — row-level security on every table, column-level write grants, server-side scoring/spending RPCs, login lockout, immutable student identity claims.
- **Extras** — 4 colour themes × light/dark, CSV exports, printed login cards, realtime updates, dark mode, full keyboard accessibility.

## Getting started

```bash
git clone https://github.com/khaszein012/GE-Classroom-Management.git
cd GE-Classroom-Management
npm install
cp .env.example .env   # fill in your Supabase URL + anon key
npm run dev
```

Requires **Node 20+**. The app expects a Supabase project with the schema below applied and `student-login` Edge Function deployed.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run typecheck` | Strict TypeScript check |
| `npm run lint` | ESLint |
| `npm run test` | 60-assertion live security suite (needs teacher env creds) |
| `npm run test:csv` | CSV parser unit tests (no credentials needed) |
| `npm run backup` | Export every table to `backups/<timestamp>/` as JSON |

## Database setup (Supabase)

Apply the migrations in `supabase/migrations/` **in filename order** via the Supabase SQL Editor (they are idempotent). Then deploy the Edge Function:

```bash
supabase functions deploy student-login
```

The migrations create: class settings, students (PIN-hashed logins), behaviours, the point-transaction ledger, rewards/redemptions with currency snapshots, the full quiz schema, RLS policies for teacher/student/anon roles, scoring and shop RPCs, and the theme preference fields.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env` / CI vars | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `.env` / CI secrets | Public anon key (RLS protects the data) |
| `TEACHER_EMAIL` / `TEACHER_PASSWORD` | shell env / CI secrets | Only for the test & backup scripts — never sent to the browser bundle |

The anon key is public by design; everything sensitive is enforced by Postgres RLS, not by hiding the key.

## Testing & operations

- **CI** runs typecheck, lint, CSV tests and a production build on every push; the live security suite runs once teacher credentials are added as repo secrets.
- **Pre-push hook** (`hooks/`, wired via `git config core.hooksPath hooks`) runs the same checks locally before anything is pushed.
- **Backups** run nightly via GitHub Actions (results kept 90 days as private artifacts) or on demand with `npm run backup`.

## Deployment

The app is a static SPA — any static host works:

```bash
npm run build   # outputs dist/
```

Deploy `dist/` to Bolt, Vercel, Netlify, Cloudflare Pages… Point the host at your repo for automatic deploys, and remember: `index.html` is an SPA route table of one page, so no rewrite rules are needed.

## Project structure

```
src/
  components/        # teacher screens + shared UI
    student/         # student portal (dashboard, shop, quizzes, runner)
  lib/
    storage.ts       # all Supabase data access (row ↔ model mapping)
    useStore.ts      # teacher app state (single source of truth)
    themes.ts        # colour-theme registry (swaps CSS token sets)
    csv.ts           # RFC-4180 parser + export helpers
  supabase/          # SQL migrations + student-login edge function
scripts/             # security suite, CSV tests, backup
```

## Security model in one paragraph

Every table has row-level security. The anon role can read nothing. Teachers are identified by the absence of a `student_id` claim; students get real Supabase sessions whose immutable `app_metadata.student_id` scopes every read and write to their own rows. Balances are never stored — they are sums over the transaction ledger. Scoring, spending, refunds and price snapshots happen inside `SECURITY DEFINER` functions that re-check every precondition under row locks. A 60-assertion suite (`npm run test`) attacks all of it continuously.
