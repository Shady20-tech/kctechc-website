# AGENTS.md — KC Technology Corporation Website

Persistent project memory for any agent (OpenHands or otherwise) working in this repository.
Read this file first, then `docs/PROJECT_BRIEF.md` for the full business/product brief and the
phase roadmap. Keep both files synchronized with the specification as the build progresses.

---

## 1. What this project is

KC Technology Corporation corporate website plus three department experiences under one brand:

| Department | Public localized path | Accent |
| --- | --- | --- |
| Corporate gateway (root, language-neutral) | `/` | Brand ink / teal |
| Digital Marketing (store) | `/{locale}/digital-marketing` | `#1E6FD9` |
| Electrical Services | `/{locale}/electrical-services` | `#B45309` |
| Real Estate | `/{locale}/real-estate` | `#127A5B` |

Accent hex values are the text-safe variants used on light surfaces; each also has a `-bright`
counterpart for dark ink bands (see section 5).

Supported locales: `en`, `fr` (URL segments stay `/en` and `/fr`; SEO language-region annotations
use `en-CM` / `fr-CM`).

## 2. Corporate facts — do not invent, do not alter

- Legal/brand name: **KC Technology Corporation**
- Corporate address: **Half-Mile, Limbe, Southwest Region, Cameroon**
- Public email: **kctechc@gmail.com**
- Public phones: **(+237) 679-202-265** and **656-218-651**
- Motto: **"Innovating Technology. Powering Infrastructure. Transforming Futures."**

Any business fact not supplied by the source material must be editable CMS content or clearly
marked development seed data, and must never appear as a production marketing claim. Never
fabricate certifications, awards, client results, property inventory, prices, product specs,
legal claims, staff, testimonials, or case-study metrics.

## 3. Locked technical decisions

- **Next.js 16.x App Router** (stable, non-canary only). `proxy.ts`, **not** `middleware.ts`.
  No custom server. No `output: export`. No `next lint` (ESLint CLI only). No `next/legacy/image`.
  `images.remotePatterns` (never `images.domains`). Async `params`/`searchParams`.
  Current stable package release at last check: see `docs/PROJECT_BRIEF.md` §"Verified versions".
- **TypeScript strict**; no `any` unless narrowly justified and documented.
- **Tailwind CSS**; **Lucide** as the single icon family.
- **Supabase**: PostgreSQL + Auth + Storage + RLS, migrations version-controlled, types generated
  from schema. Use `@supabase/ssr` with cookie-based SSR auth.
- **Tolgee** is the localization runtime/management layer. **Never install `next-intl`,
  `next-i18next`, `react-i18next`, or any competing i18n framework.**
- **Zod** for all input validation (server-side before any write).
- **Vitest** for unit/integration; **Playwright** for E2E once the app surface exists.
- **Resend** for transactional email.
- **MapLibre GL JS + OpenFreeMap** as the default map stack, behind a map adapter so Mapbox or
  Google Maps can be swapped without rewriting business logic.
- Server Components by default; Client Components only where interaction requires them.

## 4. Non-negotiable architecture rules

### Localization
- Root `/` stays language-neutral (`x-default`) — offer EN/FR + department choices, do not guess.
- Localized app lives in `src/app/(site)/[locale]/...`; the `(site)` group holds the public chrome
  and `(static)` holds internal/admin routes. `src/proxy.ts` does only lightweight
  locale/routing checks and redirects — **never** slow database fetches.
- Locale handling must validate `en`/`fr`, preserve the current route and safe query params on
  language switch, support localized slugs, emit reciprocal `hreflang` + `x-default`, and prevent
  untranslated/unpublished locale content from being indexed as fully localized pages.

### Dynamic translation rule (critical)
- Static UI text → normal Tolgee keys. Dynamic DB content → **never** static JSON dictionaries.
- Canonical structured content lives in Supabase; localized content lives in Supabase translation
  tables / typed localized fields so the site works even if Tolgee is down.
- Maintain a `translation_entries` index: stable key, entity type, entity ID, field name, source
  locale, target locales, translation state, Tolgee key/id, sync state, last sync timestamp,
  error info.
- Tolgee sync runs from server-side code or a Supabase Edge Function only. Never expose a Tolgee
  management/secret API key to the browser. Sync must be idempotent and retryable, ideally via an
  async job/webhook pattern.
- Publishing a product (or any translatable entity) must auto-create its translation entries —
  admins never create translation keys by hand.
- Source locale defaults to English. French starts `pending` unless supplied or an approved MT
  workflow is enabled. Changing a source field marks downstream translations potentially outdated
  and re-syncs, but **never destroys existing translations**.

### Security
- Supabase service-role key is server-only. No secrets in `NEXT_PUBLIC_*`.
- Authorization enforced by **RLS** in the database, not by hiding UI routes.
- Least-privilege policies for visitor/customer/agent/department staff/admin/super admin.
- Zod-validate all input; use Supabase query methods (no unsafe SQL string concatenation).
- Audit-log privileged CRUD, role changes, payment state changes, content publishing, property
  approval/rejection, and translation sync events.
- Soft-delete/archive where referential history matters. Use DB functions/transactions for
  atomic multi-record changes. FKs, check/unique constraints, indexes, sane defaults.
- Avoid RLS recursion; security-definer helpers only when necessary and hardened.
- Admin/auth/private routes are `noindex`.

### Storage
- Separate buckets/folders: public site media, product media, property media, electrical project
  media, private inquiry attachments, private admin documents.
- Public media may use public URLs; sensitive uploads use signed URLs. Validate type + size
  server-side, generate safe deterministic paths, block executable uploads, keep alt/caption/credit
  fields, keep the asset→entity→locale relationship, always render through `next/image`.

### Payments
- Provider abstraction. **Flutterwave** is the preferred initial provider (documented XAF support
  with MTN/Orange Mobile Money and cards). Server-side payment creation, idempotency, webhook
  signature verification, async state handling, server-side verification before order finalization,
  explicit pending/success/failed states, no card data in our DB, audit trail, sandbox/production
  separation, and a disabled feature flag when production credentials are absent.
- **Never fake a successful payment when credentials are missing.**
- Bank transfer may be offered as a manual/offline method until a verified provider flow exists.

### Maps & geography
- Real estate supports list/map toggle, clustered markers, single-property map, safe coordinate
  storage, and no accidental exposure of exact coordinates for private/approximate listings.
- Cameroon hierarchy: Region → Division → Subdivision. Seed the ten regions (Adamawa, Centre, East,
  Far North, Littoral, North, Northwest, West, South, Southwest) immediately; load divisions and
  subdivisions only from a vetted administrative dataset via a validated import path — never guess.
- PostGIS only when needed, in a dedicated extension schema — not exposed through `public`.

### Money
- Primary currency XAF/FCFA. USD equivalent display only where content explicitly supports it and
  never with invented exchange rates. Format with `Intl.NumberFormat` (`en-CM` / `fr-CM`).

## 5. Design system

**Brand identity comes from the artwork, not from this file.** The supplied KC logo is black ink
with a teal accent. An earlier revision of this document specified an invented navy/gold palette,
and the site was built against that instead of the real mark — which is why the UI read as
off-brand. If a palette here ever conflicts with the logo, the logo wins.

Palette, mirrored from the tokens in `src/app/globals.css` (the CSS is the source of truth;
`BRAND_COLORS` in `src/lib/config/site.ts` exists for non-CSS consumers such as the web manifest):

- Ink scale `ink-50`…`ink-950` for dark bands and text; `ink-950 #06090B` is the hero/base band.
- Brand teal `teal-700 #006E6A` (text-safe) and `teal-300 #4ED9D4` (on dark ink only).
- Department accents are contextual, set once per subtree via `data-department` and consumed as
  `--dept-accent`. Each declares two values: a text-safe one for light surfaces and a `-bright`
  counterpart for ink bands, re-bound automatically under `.on-ink`.

Rules that follow from that split:

- Never hard-code a palette hex in a component. Use tokens, or the accent variables.
- A filled accent control on a dark band needs `variant="accentOnInk"`, not `"accent"` — on ink
  bands the accent resolves to the bright value, where white text is 1.72:1.
- Any subtree that should take a department accent must set `data-department`; forgetting it
  silently falls back to corporate teal.
- Check new colour pairs against `.logo-work/contrast.py` before shipping. Every text and UI pair
  is held to WCAG AA (4.5:1 text, 3:1 boundaries).

Type: Sora (headings) + Inter (body) + JetBrains Mono for technical annotations — eyebrows, indices
and spec labels. The mono face is what carries the engineering character; it is not decoration.
Loaded via `next/font`, self-hosted at build time.

Feel: premium, corporate, engineering/investment-grade, trustworthy, spacious, restrained — not
template-like. Mobile-first for mid-range Android on mobile data. Subtle motion only for hierarchy;
all motion is neutralised under `prefers-reduced-motion`.

## 6. Performance budget

Beat the under-2.5s load goal on realistic 4G, target Core Web Vitals "Good", and stay usable on
3G/2G. Server Components first, minimal client JS, no unnecessary global providers, lazy-load
below-the-fold media and maps, responsive sizing, reserved dimensions (CLS), modern formats,
no heavy animation libraries for simple transitions, deliberate caching/revalidation, and never
make a page dynamic just because a client component could have been avoided.

## 7. SEO / AEO rules

SEO is architecture from Phase 1. Required: unique titles, meta descriptions, canonicals, locale
alternates + `hreflang`, `x-default`, stable descriptive URLs, correct `html[lang]`, Open Graph +
social images, metadata base from env, `robots.txt`, XML sitemaps, correct 404/410, clean internal
linking, breadcrumbs, server-generated structured data matching visible content, alt text and
descriptive filenames, indexation controls, `noindex` for admin/auth/private, canonical handling
for filter/sort/search states, regional/category landing pages only with unique content, redirect
management, and zero duplicate content from locale routing or query params.

Governing standard is current Google Search Central guidance, not older folklore.

AEO/GEO: use the evidence-based interpretation. Implement answer-first intros, question-style
headings where they match real intent, concise factual definitions, strong entity identity, clear
product/service/property facts, comparison tables where natural, FAQs only when genuinely useful,
author identity and `datePublished`/`dateModified` on insights, credible references for non-obvious
claims, original company knowledge, local language/geographic context, consistent NAP/department
data, crawlable text (no important content hidden behind client interaction), accessible HTML.

Do **not** create `llms.txt`, AI-only sitemaps, fake entity mentions, keyword stuffing, doorway
pages, or other unsupported "GEO hacks".

## 8. Analytics & Google ecosystem

GA4 with real business events (never pageviews only), consent-aware, **no PII ever sent**.

- Ecommerce: `view_item_list`, `view_item`, `select_item`, `add_to_cart`, `remove_from_cart`,
  `begin_checkout`, `purchase`, `refund`.
- Site conversions: `generate_lead`, `quote_request`, `property_inquiry`,
  `property_viewing_request`, `consultation_request`, `contact_submit`, `department_selection`,
  `site_search`.

Also prepare for Search Console, Merchant Center / free listings (real identifiers only, no
invented GTINs), Business Profile consistency, Rich Results testing, URL Inspection, and CWV
monitoring.

## 9. Code quality bar

Strict TypeScript; no `any` without documented justification; no silent error swallowing; no
duplicated business logic between Server and Client components; reusable server/data layer;
reusable Zod schemas; typed DB access; small components; meaningful names; comments only for
non-obvious reasoning; no dead code; **no TODO placeholders in completed work**; no mock
implementations on production paths.

## 10. Deployment targets

One codebase must work on **Vercel** and a **self-hosted VPS**. Do not rely on Vercel-only runtime
behavior. For VPS: `next start` or standalone output, Docker or a clear Node path, Nginx reverse
proxy guidance, HTTPS at the proxy, server-safe runtime config, graceful restarts, and
externalized storage/database/webhooks/cron-queue. `output: export` is forbidden (auth'd admin,
server logic, dynamic data, runtime integrations).

## 11. Per-phase workflow (mandatory)

Before editing: inspect repo structure, `package.json`/lockfile, Next.js version and config,
Supabase migrations/config, this file and any `.openhands` instructions, and determine what already
works. Never delete a working feature because another approach looks cleaner. Prefer incremental
changes. Keep this file synchronized.

At the end of every phase:
1. `tsc --noEmit` (type check) → 2. ESLint CLI → 3. unit/integration tests → 4. production build
(when practical) → 5. phase-specific smoke tests → 6. inspect generated HTML for SEO-critical public
pages → 7. fix everything found → 8. report and **STOP**.

If an external credential is unavailable, test the code path with a deterministic config or a
disabled state — never by pretending the external service succeeded.

End-of-phase report must list: what changed; important files added/changed; migrations added; env
vars added; commands/tests run; genuinely external/blocked issues; and explicit confirmation that
acceptance criteria pass. Then stop — do not start the next phase.

## 12. Current repository status

- Branch: `main`.
- Phase 0 (specification capture, agent rules, project brief, env template) is complete.
- Phase 1 (secure, typed foundation) is implemented: Next.js 16 App Router + strict TypeScript,
  Supabase clients/RLS migrations, auth roles + guards, i18n routing, SEO/AEO metadata, design
  system, app shell, admin shell, health endpoint, and Vitest coverage.
- Phase 1 public surface is now complete: corporate gateway `/`, localized home `/en` + `/fr`,
  the three department entry pages, `/about`, `/contact` with the inquiry pipeline (migration,
  Zod schema, server action, form), and the shared design/UI kit. 93 Vitest tests pass and the
  production build prerenders all 23 routes.

### Phase 1 gotchas worth not rediscovering

- **Tolgee `staticData` is keyed by language first**, then namespace:
  `{ en: { ...messages } }`. Passing the raw message object (or `{ "": messages }`) logs
  `Tolgee: Missing records in "staticData"`. Use `Tolgee().init({...})` with a
  real `tolgee` instance prop — the `@tolgee/react` v7 provider takes `tolgee`/`ssr`, not `config`.
- **`staticData` must include the whole fallback chain, not just the active locale.** With
  `fallbackLanguage: "en"`, a French render still resolves English records for any key missing from
  `fr`, so shipping only `{ fr }` warns and prerenders partially. `TolgeeProvider` therefore maps
  every entry in `LOCALES`, and the warning disappears only when both dictionaries are present.
- **`useSearchParams` in a shared layout component aborts prerendering** with
  "should be wrapped in a suspense boundary". `LanguageSwitcher` deliberately reads only
  `usePathname` so localized pages stay statically prerendered.
- **Vitest cannot resolve the `server-only` marker package.** It is aliased to a no-op stub in
  `vitest.config.ts`; the real build-time guard still applies to app builds.
- **CSP is applied in `next.config.ts` headers** via `buildContentSecurityPolicy()`. The helper
  existing in `src/lib/security/headers.ts` is not enough — a control that is defined but unwired
  gives false confidence.
- **`globals.css` is imported once, from `src/app/layout.tsx`.** The route groups no longer import
  it: `(site)/page.tsx`, `(site)/[locale]/layout.tsx` and `(static)/admin/layout.tsx` previously
  each imported it at their own relative depth, which duplicated CSS and made the path brittle.
- **`<html>`/`<body>` belong to the root layout only.** The locale and admin layouts render chrome
  (`SiteHeader`/`SiteFooter`, admin `main`), not the document. A layout that renders `<html>` below
  the root breaks `not-found.tsx` and `error.tsx`, which render inside the root layout.
- **`inquiries` has no anonymous insert policy.** The public form writes through the service-role
  client in a server action after Zod validation, rate limiting and a honeypot check. Adding an
  anon insert policy would let a browser bypass all three.
- **`database.types.ts` relationships must resolve inside `public`.** Adding a `Relationships` entry
  that points at `auth.users` (e.g. `inquiries.assigned_to`) makes Supabase's `RejectExcessProperties`
  collapse the whole schema to `never`, and every `.from(...)` call then fails typecheck with
  confusing errors far from the file. Only reference relations that are declared in this file.
- **Client-only browser state uses `useSyncExternalStore`, not `setState` in an effect.** The
  `react-hooks/set-state-in-effect` rule rejects the effect form, and the external-store form also
  gives a defined SSR snapshot. See `src/lib/hooks/use-client-environment.ts`.
- Next 16 emits `hrefLang` (camelCase) in prerendered HTML; HTML attribute parsing is
  case-insensitive, so `hreflang` alternates are correct.
- **A page title that already contains the brand name must be `title: { absolute: ... }`.** The root
  layout applies a `%s | <legal name>` template, so a literal string title renders the brand twice
  ("KC Technology Corporation | KC Technology Corporation"). `buildMetadata` handles this
  automatically for titles containing `SITE.legalName`; static `metadata` exports must set
  `absolute` by hand.
- **Verify rendered HTML, not just source.** Several defects in this phase — duplicated titles,
  a stale `theme-color`, three department cards sharing one accent — were invisible in the code and
  only showed up in `curl` output. Prerendered HTML is the ground truth.

See `docs/PROJECT_BRIEF.md` for the phase roadmap and the exact next step.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
