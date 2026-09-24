# KC Technology Corporation — Website Project Brief & Phase Roadmap

Source of truth for the production build. Read alongside `AGENTS.md` (agent rules) and
`README.md` (how to run things). Keep all three synchronized as the build advances.

---

## 1. Business context

KC Technology Corporation operates three departments under one corporate brand:

1. **Digital Marketing** — storefront, services, products, insights.
2. **Electrical Services** — capabilities, projects, quote/consultation requests.
3. **Real Estate** — nationwide listings across Cameroon, agents, inquiry/approval queue.

The corporate root is a premium gateway routing visitors into the three department experiences.

### Verified corporate data

| Field | Value |
| --- | --- |
| Company / brand name | KC Technology Corporation |
| Corporate address | Half-Mile, Limbe, Southwest Region, Cameroon |
| Public email | kctechc@gmail.com |
| Public phone 1 | (+237) 679-202-265 |
| Public phone 2 | 656-218-651 |
| Motto | Innovating Technology. Powering Infrastructure. Transforming Futures. |

Anything not in this table is **not** a supplied business fact. It must be CMS-editable content or
clearly marked development seed data excluded from production claims.

## 2. Localization summary

- URL locales: `/en`, `/fr`. Root `/` = language-neutral corporate gateway / `x-default`.
- SEO annotations: `en-CM`, `fr-CM`.
- Runtime/management: **Tolgee only** (no `next-intl`, `next-i18next`, `react-i18next`).
- Public localized tree: `src/app/[locale]/...`. Request interception: `src/proxy.ts` (light only).
- Dynamic content localization via Supabase translation tables + a `translation_entries` index;
  Tolgee sync is server-side, idempotent, retryable, and never exposes secrets to the browser.

## 3. Verified package versions (checked against the npm registry)

These were the current stable releases at the time this brief was written. Every phase must
re-check and use the latest **stable, non-canary** release within the supported line, and pin
exact versions in the lockfile.

| Package | Version at last check | Notes |
| --- | --- | --- |
| `next` | `16.3.6` (`latest`; `canary` `16.4.0-canary.42`) | Stay within stable `16.x`. The brief's "16.3.5" is superseded by `16.3.6`. Never install canary. |
| `react` | `19.3.0` | Must satisfy the chosen Next.js peer range. |
| `tailwindcss` | `4.3.3` | v4 uses the CSS-first `@import "tailwindcss"` + `@theme` model; configure accordingly (no legacy `tailwind.config.js` `content` array required). |
| `typescript` | `7.0.2` | Prefer the stable line compatible with the installed `@types/*` and Next.js tooling. |
| `vitest` | `5.0.1` | Unit/integration runner. |
| `@supabase/ssr` | `0.12.7` | Cookie-based SSR auth. |
| `zod` | `4.6.5` | Input validation. |
| `@tolgee/react` | `7.2.1` | Runtime/translation layer. |

Also required but not version-checked yet: `lucide-react`, `maplibre-gl`, `resend`, `playwright`,
`@supabase/supabase-js`, and the payment-provider SDK (Flutterwave) added in the payments phase.

> Note on TypeScript 7: verify that Next.js 16.3.6 tooling, ESLint, and `@types/react` resolve
> cleanly with TypeScript 7 before locking it. If a peer conflict appears, fall back to the latest
> stable TypeScript 5.x line and document the reason in `AGENTS.md`.

## 4. Schema domains to implement

profiles/users/roles · departments · services + translations · products + translations + media ·
categories · inventory · carts · orders + order items · payment records + payment events ·
electrical projects + translations + media · property listings + translations + media + amenities ·
regions → divisions → subdivisions → neighborhoods · agents · property submissions / approval
queue · saved properties / saved searches / alert preferences · insights/blog + categories +
authors + translations + media · inquiries + messages/events + assignments · appointments / quote
requests / site visits · site settings · SEO overrides · redirects · translation index + sync jobs ·
audit logs · analytics/conversion records.

## 5. Roles

visitor · registered customer · real-estate agent · digital marketing staff · digital marketing
admin · electrical staff · electrical admin · department staff · super admin.
UI may vary by role; **access is enforced by server authorization + RLS**.

## 6. Reminder list for every phase

- Preserve working functionality; incremental changes only.
- The required area per phase must be fully met — no fabricated data on production paths.
- SEO, accessibility (WCAG 2.1 AA), and performance budgets apply from Phase 1 onward.
- Run type check → lint → tests → build → phase smoke tests → HTML inspection, then report and stop.

## 7. Phase roadmap

Each phase is meant to be a self-contained prompt to the agent. Acceptance criteria live in the
original spec; the summary below tracks progress.

### Phase 0 — Specification capture & agent rules ✅ (this commit)
- Commit the business brief, agent rules, project brief, and env template to `main` as markdown.
- **Acceptance:** `AGENTS.md`, `docs/PROJECT_BRIEF.md`, `README.md`, `.env.example` exist and
  accurately reflect the spec; repository state documented. No application code yet.

### Phase 1 — Foundations (next)
- Scaffold Next.js 16 App Router + TypeScript strict + Tailwind v4 + ESLint CLI + Vitest.
- Baseline metadata, `metadataBase`, `robots.ts`, `sitemap.ts`, `html[lang]`, OG defaults.
- Corporate design tokens, `next/font` type system, header/footer shells, root gateway `/`.
- Locale routing scaffold (`/en`, `/fr`) with `proxy.ts` (light checks only) + `hreflang`.
- `next/image` configuration with `remotePatterns`.
- **Acceptance:** production build succeeds, lint + type check clean, Vitest runs, root + locale
  routes render server-side with correct metadata and accessible markup.

### Phase 2 — Supabase foundation
- Supabase project config, migrations for core domains (profiles/roles, departments, translation
  index), RLS policies, generated TypeScript types, `@supabase/ssr` cookie auth.
- Seed the ten Cameroon regions; validated import path for divisions/subdivisions.
- **Acceptance:** migrations apply cleanly, RLS verified with policy tests, types regenerate, auth
  flows work server-side.

### Phase 3 — Department surfaces & content
- Digital Marketing, Electrical Services, Real Estate department pages with localized slugs,
  breadcrumbs, structured data, and SEO overrides.
- Services/products/projects/property listing data layer with translation tables + auto-created
  translation entries on publish.

### Phase 4 — Store, cart, orders, payments
- Catalog, cart, checkout, Flutterwave adapter with idempotency + webhook verification, order and
  payment state machine, audit trail, disabled state when credentials are absent.

### Phase 5 — Real estate platform
- Listings, media, amenities, agent workflows, inquiry + approval queue, map adapter
  (MapLibre + OpenFreeMap default), geographic filtering, PostGIS in a dedicated schema when needed.

### Phase 6 — CRM, admin, translations health
- Admin panel (noindex) for all domains, inquiry/CRM workflows, translation health + Tolgee sync
  jobs, audit log viewer, site settings, SEO management, redirects.

### Phase 7 — Analytics, SEO hardening, performance, launch
- GA4 consent-aware events, Search Console / Merchant Center readiness, CWV tuning, Playwright
  smoke suite, deployment docs for Vercel and VPS (Docker/Nginx), final acceptance.

Progress is tracked per phase; do not start a phase until the previous phase's acceptance criteria
and verification commands pass.
