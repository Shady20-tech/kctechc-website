# KC Technology Corporation — Website

Corporate website for **KC Technology Corporation**, combining a premium corporate gateway with
three department experiences: **Digital Marketing**, **Electrical Services**, and **Real Estate**.

> *Innovating Technology. Powering Infrastructure. Transforming Futures.*

---

## Repository status

**Phase 0 — specification capture is complete. No application code exists yet.**

The repository currently contains only the project specification, agent rules, and an environment
template. The Next.js application is scaffolded in Phase 1.

| File | Purpose |
| --- | --- |
| `README.md` | This overview and the phase index. |
| `AGENTS.md` | Persistent rules for any agent working in this repo (stack, architecture, quality bar, per-phase workflow). **Read this first.** |
| `docs/PROJECT_BRIEF.md` | Full business/product brief, verified data, package versions, schema domains, and the phase roadmap. |
| `.env.example` | Safe placeholder environment template. Copy to `.env.local` and fill in real values. |

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
| 1 | Next.js foundations, design tokens, locale scaffold, SEO baseline | ⏳ Next |
| 2 | Supabase foundation, migrations, RLS, auth, region seed | Planned |
| 3 | Department surfaces & content, translation pipeline | Planned |
| 4 | Store, cart, orders, Flutterwave payments | Planned |
| 5 | Real estate platform, map adapter, geographic search | Planned |
| 6 | CRM, admin panel, translation health, audit logs | Planned |
| 7 | Analytics, SEO hardening, performance, launch | Planned |

Each phase is executed as a self-contained prompt and must pass its acceptance criteria and
verification commands before the next phase begins. See `docs/PROJECT_BRIEF.md` §7.

## Getting started (once Phase 1 lands)

```bash
cp .env.example .env.local   # then fill in real values
npm install
npm run dev
```

Additional scripts (`build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`) are added in Phase 1.

## Conventions

- Do not fabricate business facts, certifications, prices, inventory, or claims. Unsupplied data is
  either CMS-editable content or clearly marked development seed data.
- SEO, WCAG 2.1 AA accessibility, and the performance budget apply from Phase 1 onward.
- Never commit real credentials; only `.env.example` is tracked.
