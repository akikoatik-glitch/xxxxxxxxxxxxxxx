# Assist.

Intelligent AI customer-service & order automation for Algerian businesses.

A self-hosted SaaS platform with a premium liquid-glass marketing site, a real AI order/CS agent that speaks Arabic, French, English & Darija, a unified inbox (WhatsApp / Instagram / Facebook / Telegram), order management, automatic PDF invoices, and a business dashboard.

## Features

- **AI agent** — understands FR / EN / AR / Darija, answers product & price questions, runs the full ordering flow (product → quantity → name → phone → wilaya → address → confirmation), and escalates to a human when needed. Never invents prices/stock — always reads the catalog from your database.
- **Hybrid AI engine** — works out-of-the-box with a local rule/context engine (no API keys required). Optional configurable LLM provider (OpenAI / Anthropic / Gemini / local) via env.
- **Unified inbox** — conversations from WhatsApp, Instagram, Facebook & Telegram in one place, with human takeover.
- **Orders** — order creation, status workflow (new → confirmed → preparing → shipped → delivered / cancelled), automatic PDF invoice generation.
- **Dashboard** — revenue, orders, customers, platform stats, AI response rate, recent activity.
- **Digital-goods friendly** — cash-on-delivery default, multi-currency.

## Tech stack

- Node.js >= 22, Express 5
- SQLite via built-in `node:sqlite` (no separate DB server)
- PDFKit for invoices
- Vanilla JS SPA dashboard + landing page (no build step)

## Quick start

```bash
npm install
copy .env.example .env        # or: set env vars
npm start                     # server on port 4000
```

Then open:

- `http://localhost:4000` — landing page
- `http://localhost:4000/register` — create your business account
- `http://localhost:4000/app/dashboard` — business dashboard

## Environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | HTTP port | `4000` |
| `JWT_SECRET` | Secret for auth tokens (generate a strong one) | *(generated)* |
| `DB_PATH` | SQLite database file path | `./data/assist.db` |
| `NODE_ENV` | `development` / `production` | `development` |
| `LLM_PROVIDER` | `none` (local engine) / `openai` / `anthropic` / `gemini` / `local` | `none` |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | API keys (only if using those providers) | — |

The AI works with **zero API keys** by default (`LLM_PROVIDER=none`). To use a real LLM, set `LLM_PROVIDER` plus the matching key in `.env`.

## Connecting messaging platforms

Each platform uses its official API / webhook. Credentials are stored on the **server** (via the Connect screen → dashboard settings), never in frontend code.

Webhook URLs (configure these in the platform dashboards):

- WhatsApp Cloud API: `https://<host>/webhook/whatsapp`
- Telegram: `https://<host>/webhook/telegram`
- Facebook Messenger: `https://<host>/webhook/facebook`
- Instagram: `https://<host>/webhook/instagram`

## Project structure

```
server/
  index.js                Express app, routing, static + SPA serving
  db.js                   SQLite schema + helpers (audit, notify, numbering)
  auth.js                 JWT auth
  ai/
    engine.js             Hybrid intent detection + order flow (FR/EN/AR/darija)
    llm.js                Optional LLM provider adapter
    text.js               Language detection
  routes/                 REST API (auth, business, dashboard, conversations,
                          orders, products, customers, ai-settings,
                          integrations, notifications, webhook)
  services/               pdf (invoices), conversation, notifications
  integrations/           WhatsApp / Telegram / Facebook / Instagram adapters
  middleware/             rate limiting, auth
public/
  index.html              Landing page
  login.html / register.html
  css/  js/               Landing + dashboard (SPA) assets
views/
  app.html                Dashboard SPA shell
data/
  assist.db               SQLite database
  pdfs/                   Generated PDF invoices
```

## License

Private / proprietary — for the business it was built for.
