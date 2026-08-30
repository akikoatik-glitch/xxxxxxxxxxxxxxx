# XWhiz — Real-Data Rebuild Report

Date: 2026-08-30

## What changed (before → after)

### 1. Data is real
Before: page code and stats were hard-coded and inconsistent — the hero strip showed different
"live fixtures" numbers than the league cards, teams/leagues/dates were invented, and results were
mock fixtures.

After: fixtures and results come from the real **openfootball/football.json** dataset (freely
licensed, no API key). Five leagues: Premier League, La Liga, Serie A, Bundesliga, Ligue 1 —
current (2026-27) and previous (2025-26) seasons are bundled as JSON snapshots
(`src/data/snapshots/`), so the app works offline and on any serverless runtime, with an optional
daily network refresh.

- New data core: `src/data/service.ts`, `src/data/providers/openfootball.ts`,
  `src/data/{types,time,leagues}.ts`, `src/data/snapshots/registry.ts`.
- Real per-league average goals now derive from actual finished results
  (EPL 2.96, La Liga 2.80, Serie A 2.67, Bundesliga 3.37, Ligue 1 3.07).
- Normalized, real match ids: `epl-arsenal-fc-vs-liverpool-fc-20260830`.

### 2. Predictions are honest and reproducible
Before: single random "confidence" number, fabricated on every render; no tracking.

After: a Poisson model (v3.0) computes probabilities from real team attack/defence rates that blend
transparent, documented priors with real observed form. Every pick is **snapshotted once before
kickoff** into an immutable journal (`src/lib/predictionStore.ts`) with model version, generated
time, fair odds (labelled as model fair odds, not bookmaker odds) and xG. Persistence: Prisma →
local JSON file → in-memory.

Evaluation is only ever run against the real final result — hit rate, Brier score, ROI (simulated
at model fair odds), per-league and per-week accuracy are computed solely from evaluated pre-kickoff
picks. No evaluated picks yet → the stats page shows "Collecting evaluated picks…" instead of zeros.

### 3. One source of truth for the UI
Before: hero vs. league-strip mismatch.

After: home page (`/`), predictions list, prediction detail, stats, leagues and teams pages all read
the same real-data service. The conflicting numbers bug is gone.

### 4. Honest extras removed
- Weather on match pages (was fake) — removed entirely.
- "Live" indicators — removed; there is no live feed. Statuses are `scheduled` or `finished`.
- Bogus hit-rate % and "team calibrates" claims — replaced with real evaluated-stat states.
- Fake outcome-distribution pie chart on stats — replaced with evaluated picks by league.
- "And Champions League" claims — site covers exactly 5 competitions.

### 5. Pages rebuilt
- Home: hero stats (today's real fixtures, competitions, average confidence) + league cards with
  real per-league fixture counts + top picks.
- `/predictions` (server-rendered, filters/search, grouped by day).
- `/predictions/[id]` (full detail, odds panel, result box when settled, model version, CTA).
- `/stats` (accuracy/brier/weekly/ROI from evaluated picks, disclaimers).
- `/leagues` + `/leagues/[slug]` (real standings with form, picks, recent results).
- `/teams` + `/teams/[slug]` (real clubs, transparent priors labelled "Model attack/defence prior",
  fixtures and graded results).
- `/dashboard` (client watchlist backed by `/api/predictions`), `/admin` (system status).

### 6. Infrastructure
- Auth-free and rate-bounded APIs: `/api/predictions`, `/api/predictions/[id]`, `/api/leagues`,
  `/api/stats`.
- Daily sync route `/api/football/sync` (guarded) + `vercel.json` cron (05:05 UTC) with ISR
  revalidation.
- Prisma `Prediction` model added for durable journal persistence.
- Verified: production build passes (130 pre-rendered pages incl. 107 team pages), all key pages
  return HTTP 200 and render real data in a local `next start` smoke test.

## Deploy checklist (user action required)

1. Set `NEXT_PUBLIC_SITE_URL` in Vercel to the real production URL — canonical URLs, JSON-LD and the
   sitemap currently point to the old preview host (`https://xwhizliteeeeeeeeeeee.vercel.app`).
2. Set `DATABASE_URL` (a Postgres instance) for durable prediction-journal persistence; without it,
   evaluation/stats memory is per-instance and stats may reset between cold starts.
3. Optional `XWHIZ_SYNC_SECRET` — the cron will still run on Vercel's internal auth.
4. Verify the Vercel cron "05 05 * * *" is within plan limits (hobby = 1 daily cron, OK).
5. Re-add Google Fonts is downloaded automatically at build on Vercel (fonts.gstatic.com must be
   reachable from the build VM).
6. If the app was previously deployed, push to GitHub and redeploy, then re-run the smoke checklist
   on the live URL (all pages 200, no `⚡ XWhiz` fake-stat text, correct league labels).