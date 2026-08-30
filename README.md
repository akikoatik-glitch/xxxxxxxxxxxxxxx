# XWhiz Lite

**Predict Smarter. Win Bigger.** — AI-powered football match predictions with a 3D premium dark interface.

XWhiz Lite runs a Poisson-based xG engine over 6 elite leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League) and grades every fixture with win probabilities, confidence ratings, value odds and deep match analysis. Free tier + Premium subscription ($9.99/mo) via Stripe.

> Runs in **demo mode** out of the box (deterministic mock data feed) — add API keys to go live with Supabase auth, Stripe billing, Resend email and GA4.

---

## Tech Stack

| Layer      | Tech                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------- |
| Framework  | Next.js 14 (App Router) + TypeScript + Tailwind CSS 3.4                                        |
| 3D / UI    | Three.js (globe + particles), Framer Motion 11, Recharts, Radix UI, Lucide icons, next-themes  |
| Database   | Supabase (Postgres + Auth) with Prisma ORM                                                     |
| Payments   | Stripe Checkout + webhooks (subscription tier sync)                                            |
| Email      | Resend (newsletter double duty)                                                                |
| SEO        | next-sitemap, native metadata API, Schema.org (SportsEvent, WebSite, BreadcrumbList), GA4      |
| Deploy     | Vercel (app + API routes) + Supabase (DB + auth)                                               |

## Quick Start

```bash
npm install
cp .env.example .env.local   # optional — demo mode works without keys
npm run dev                  # http://localhost:3000
```

> The project works fully without any environment variables (mock data + demo auth). Every integration activates automatically when its keys are present.

## Environment Variables

See `.env.example` for the full list. Highlights:

| Variable                          | Purpose                                        |
| --------------------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` | Auth (login/signup)                          |
| `DATABASE_URL`                    | Prisma → Supabase Postgres                     |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` | Premium checkout ($9.99/mo recurring price) |
| `STRIPE_WEBHOOK_SECRET`           | Sync subscription tier to users                |
| `RESEND_API_KEY`                  | Newsletter emails                              |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`   | Google Analytics 4                             |
| `API_FOOTBALL_KEY` / `OPENWEATHER_API_KEY` | Reserved for live data feeds          |

## Deploy to Vercel + Supabase

1. **Supabase**: create a project → run `supabase/migrations/0001_init.sql` in the SQL editor (or `npx prisma db push`) → copy the API URL, anon key and the pooled connection string into `DATABASE_URL`.
2. **Stripe**: create a product with a **$9.99/month recurring price** → copy the price ID (`price_...`) and secret key → add a webhook endpoint `https://yourdomain.com/api/webhooks/stripe` for events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. **Vercel**: push this repo to GitHub → *Add New Project → Import* → paste the env vars from `.env.example` → Deploy. Build command is `npm run build` (runs `prisma generate` + `next build` + `next-sitemap`).

## Scripts

| Script             | What it does                                  |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Local dev server                              |
| `npm run build`    | prisma generate → next build → next-sitemap   |
| `npm run start`    | Serve production build                        |
| `npm run lint`     | ESLint (next/core-web-vitals)                 |
| `npm run db:push`  | Push Prisma schema to the database            |

## Project Structure

```
├── middleware.ts              # Supabase session refresh
├── prisma/schema.prisma       # User, WatchlistItem, NewsletterSubscriber
├── supabase/migrations/       # SQL schema + RLS policies
├── public/                    # logo, sitemap output
└── src/
    ├── app/
    │   ├── page.tsx           # Home (3D hero, featured picks, funnel)
    │   ├── predictions/       # Explorer + [id] match analysis
    │   ├── leagues/[slug]/    # Standings + league picks
    │   ├── stats/             # Transparent model performance
    │   ├── pricing/           # Free vs Premium + FAQ
    │   ├── login | signup | dashboard | admin
    │   └── api/               # predictions, leagues, stats, checkout,
    │                          # stripe webhook, newsletter
    ├── components/            # 3D globe, Prediction Pulse, cards, charts…
    ├── hooks/use-tilt.ts      # 3D perspective tilt on hover
    └── lib/
        ├── engine.ts          # Poisson xG prediction engine
        ├── predictions.ts     # Aggregation + model metrics
        ├── data/              # Leagues, teams, fixtures (mock feed)
        └── supabase | stripe | prisma | watchlist
```

## Signature Design: the Prediction Pulse

Every ULTRA pick (80%+ model confidence) emits an expanding 3D glow ring — cyan core, purple outer ring — rendered with pure CSS keyframes (`PredictionPulse` component). Combined with perspective card tilt, glassmorphism panels, 3D cylindrical probability bars and flip league badges, it is the element users remember.

## Responsible Play

This product is for entertainment and statistical insight. 18+. No guarantees of winnings — bet responsibly.
