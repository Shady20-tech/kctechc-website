# KC Technology Corporation — Website

Corporate website for **KC Technology Corporation**, combining a premium corporate gateway with
three department experiences: **Digital Marketing**, **Electrical Services**, and **Real Estate**.

> *Innovating Technology. Powering Infrastructure. Transforming Futures.*

---

## Repository status

**Phases 0–8 are implemented on `main`.** The application is a working Next.js 16 App Router site
with Supabase (PostgreSQL, Auth, Storage, RLS), the three department surfaces, the Digital Marketing
store, the real-estate platform, an admin console, and an orders/payments path. The `main` branch is
the current state; the phase table below records what each phase delivered.

| File | Purpose |
| --- | --- |
| `README.md` | This overview and the phase index. |
| `AGENTS.md` | Persistent rules for any agent working in this repo (stack, architecture, quality bar, per-phase workflow). **Read this first.** |
| `docs/PROJECT_BRIEF.md` | Full business/product brief, verified data, package versions, schema domains, and the phase roadmap. |
| `.env.example` | Safe placeholder environment template. Copy to `.env.local` and fill in real values. |
| `supabase/migrations/` | Version-controlled schema, RLS policies and functions. |
| `supabase/validate/` | Behavioural validation scripts run against a local Postgres 17. |

## Corporate data

| Field | Value |
| --- | --- |
| Company / brand | KC Technology Corporation |
| Address | Half-Mile, Limbe, Southwest Region, Cameroon |
| Email | kctechc@gmail.com |
| Phones | (+237) 679-202-265, 656-218-651 |
| Motto | Innovating Technology. Powering Infrastructure. Transforming Futures. |

## Planned routes

| Area | Route |
| --- | --- |
| Corporate gateway (language-neutral, `x-default`) | `/` |
| Localized site root | `/{locale}` (`en`, `fr`) |
| Digital Marketing | `/{locale}/digital-marketing` |
| Electrical Services | `/{locale}/electrical-services` |
| Real Estate | `/{locale}/real-estate` |

## Planned stack

Next.js 16 App Router · TypeScript (strict) · Tailwind CSS v4 · Lucide · Supabase (PostgreSQL,
Auth, Storage, RLS) · Tolgee · Zod · Resend · MapLibre GL JS + OpenFreeMap · Vitest · Playwright.

Full details, version notes, and constraints are in `AGENTS.md` and `docs/PROJECT_BRIEF.md`.

## Phase roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Specification capture, agent rules, env template | ✅ Complete |
| 1 | Next.js foundations, design tokens, locale scaffold, SEO baseline | ✅ Complete |
| 2 | Supabase foundation, migrations, RLS, auth, region seed | ✅ Complete |
| 3 | Department surfaces & content, translation pipeline | ✅ Complete |
| 4 | Store, cart, orders, checkout (email-to-confirm, no on-site payment) | ✅ Complete |
| 5 | Electrical projects, private attachments, quote requests | ✅ Complete |
| 6 | Real estate listings, geography, map adapter, admin console | ✅ Complete |
| 7 | Customer favourites, saved searches, geographic landing pages | ✅ Complete |
| 8 | Orders/payments, CRM inbox, function EXECUTE hardening | ✅ Complete |

Each phase is executed as a self-contained prompt and must pass its acceptance criteria and
verification commands before the next phase begins. See `docs/PROJECT_BRIEF.md` §7.

## Getting started

```bash
cp .env.example .env.local   # then fill in real values
npm install
npm run dev
```

Verification commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
Prettier is pinned but not yet enforced as a gate — run `npm run format` on files you touch, or
`npm run format:check` for the full check.

## Conventions

- Do not fabricate business facts, certifications, prices, inventory, or claims. Unsupplied data is
  either CMS-editable content or clearly marked development seed data.
- SEO, WCAG 2.1 AA accessibility, and the performance budget apply from Phase 1 onward.
- Never commit real credentials; only `.env.example` is tracked.
