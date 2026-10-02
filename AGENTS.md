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
- Provider abstraction. **Fapshi** is the provider (Cameroon, XAF only, MTN/Orange Mobile Money;
  it has no card channel). Server-side payment creation via `POST /initiate-pay`, webhook secret
  verification through the `x-wh-secret` header, async state handling, server-side verification
  through `GET /payment-status/{transId}` before order finalization, explicit pending/success/failed
  states, no card data in our DB, audit trail, sandbox/live separation via `FAPSHI_BASE_URL`, and a
  disabled feature flag when production credentials are absent.
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

### Geometry and depth

Radius is a **scale, not a value** — pick the step named for the element rather than re-guessing a
number per call site. `rounded-field` (10px) for inputs, `rounded-control` (14px) for buttons, nav
pills and icon tiles, `rounded-card` (20px) for cards, panels, media and CTA bands, `rounded-panel`
(28px) for hero shells and modals. The old single-step rule is why a 40px icon tile used to look
bulbous: a value that reads as generous on a card is wrong on a small square.

Shadows are **stacks of 3–4 low-opacity layers**, never one strong drop. A single
`0 4px 8px rgba(…, 0.2)` reads as a hard edge under the element; several wide, negative-spread layers
at 2–8% read as light falling around it. Keep the 1px contact layer, and roughly double blur while
halving alpha for each successive layer. Adding a heavier single shadow to make something "pop"
breaks the language.

Glass (`surface-glass-ink`, `surface-glass-light`) is `@supports`-scoped and sets **only**
`background-color` + `backdrop-filter`. That is deliberate: it makes the utility a pure override, so
the element's own opaque `bg-*` stays in the markup as the no-support fallback and wins wherever blur
is unavailable. Do not move the border or the opaque background into the utility — a browser without
`backdrop-filter` would then render a translucent fill with no blur, which fails contrast.

**Glass tint is a contrast decision, not a taste one.** A translucent header composites over whatever
is behind it, and the worst case is the sticky header at scroll 0 sitting over the *white* page, not
over the dark hero. At `0.72` the inactive language link (`text-white/60`) measured **4.21:1**; the
current `0.78` gives **4.98:1**. Anything that lightens the tint, or lowers the opacity of text on
glass, needs that pair re-measured. Lighthouse catches this — run it, don't eyeball it.

Motion classes `cta-lift` and `card-lift` animate **transform and box-shadow only** (never `top`,
`margin` or `height`) so nothing reflows. `cta-lift` is guarded with `:not(:disabled)`: without it a
disabled button still nudges on hover and promises an interaction it refuses. New hover classes must
be added to the `prefers-reduced-motion` block in `globals.css`.

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
  Zod schema, server action, form), and the shared design/UI kit.
- Primary navigation is `Home · About us · Departments (dropdown) · Services · Gallery · Contact ·
  Insights`. Departments are a dropdown on desktop and a labelled group in the mobile drawer; the
  department anchors stay in the DOM while the panel is closed so all three remain crawlable.
- `/services` is a corporate index that routes to the three departments. `/gallery` renders an
  explicit empty state because no project photography was supplied — see the gotcha below before
  filling it.
- Phase 3 (services / insights / case studies content layer) is implemented:
  - Migrations `20260101000007_services_and_entity_seo.sql`,
    `20260101000008_insights.sql`, `20260101000009_case_studies_and_inquiry_service.sql`, plus a
    regenerated `src/lib/db/database.types.ts` (20 tables).
  - Content layer `src/lib/content/*`: record types with per-field localization merge, the nine
    Digital Marketing services with a full French overlay, category/author/case-study defaults, and
    Supabase-backed loaders that fall back to bundled content on any failure.
  - Surfaces: `/[locale]/[department]` (department home with catalogue, process, commitments, FAQ),
    `/[locale]/[department]/services` and `/services/[service]`, `/[locale]/[department]/portfolio`,
    `/[locale]/insights` with `/[slug]` and `/category/[category]`.
  - Structured data: `Service`, `Article`, `FAQPage` and `BreadcrumbList` JSON-LD, all built from
    the same values the page renders.
  - Inquiry tagging: `?department=` and `?service=` prefill the contact form, and the action resolves
    the service to a real row and records `source = service_inquiry`.
- `/blog` permanently redirects (308) to `/insights`, which is the canonical articles URL.
- Phase 4 (Digital Marketing store) is implemented:
  - Migrations `20260101000010_store_enums.sql`, `20260101000011_store_products.sql`,
    `20260101000012_product_translation_workflow.sql`, plus a regenerated
    `src/lib/db/database.types.ts`.
  - A local Postgres 17 validation harness under `supabase/validate/` (shim + behavioural
    assertions) that proves RLS, stock/availability derivation and the translation triggers
    without a hosted project. `00_supabase_shim.sql` provides the `anon`/`authenticated`/
    `service_role` roles the migrations grant to.
  - Translation layer `src/lib/translation/keys.ts` (deterministic `entity.id.field.locale` keys)
    and `src/lib/tolgee/{server-client,sync-worker}.ts` (Tolgee REST v2, idempotent upsert by key).
  - Store layer `src/lib/store/*`: `types` (money, availability, condition, specification parsing),
    `slug-resolution` (locale-scoped matching with canonical fallback), `defaults` (per-field
    localization + `hasFallback`), `loaders`, `storage`, `search`, `cart`, `cart-actions`,
    `product-input` (shared Zod schema), `admin-actions`.
  - Surfaces: `/[locale]/digital-marketing/store` (index), `/[category]`, `/[category]/[slug]`,
    `/cart`, plus `/admin/store/new` for editors.
  - `Product`/`Offer`/`ItemList` JSON-LD; store paths added to nav, `NAV_PATHS` and the sitemap.
- 255 Vitest tests pass and the production build prerenders all store routes.
- Phase 7 (Real Estate platform) is implemented:
  - Migrations `20260101000028_customer_favorites_and_saved_searches.sql`,
    `20260101000029_geo_landing_content.sql`, `20260101000030_listing_search_filters.sql` and
    `20260101000031_public_listing_status_policy.sql`, plus a regenerated
    `src/lib/db/database.types.ts` (`search_property_listings` gained `p_property_type`).
  - `supabase/validate/20_real_estate_platform_behaviour.sql` proves the listing search, the
    public status policy, the favourites/saved-search RLS and the geographic landing-page
    indexability rule on a fresh database.
  - Search layer `src/lib/real-estate/search.ts`: typed `ListingFilters`, defensive parsing of
    every URL value, a canonical serializer, `normalizeSearchQuery` (used to store a saved
    search), active-filter derivation and single-filter removal.
  - Customer layer `src/lib/real-estate/customer-actions.ts`: favourites, saved searches and
    alert preferences, all written with the **session** client so RLS is the control.
  - Surfaces: `/real-estate/listings` (browse + map, filter panel, active-filter chips,
    pagination, per-card save control, save-this-search), `/real-estate/listings/[slug]`,
    `/real-estate/favorites` and `/real-estate/saved-searches`.
  - `ListingFilterPanel`, `ActiveFilterChips`, `ListingPagination`, `FavoriteButton`,
    `SaveSearchControl` and `SavedSearchCard` components; `ListingFiltersForm` was deleted as
    superseded dead code.
- Phase 8 (orders, payments, CRM) and Phase 11 (Fapshi payment provider) are implemented:
  orders/order-items/payments migrations, the order state machine, the CRM inbox, the admin console,
  and the Fapshi adapter behind a provider seam (`src/lib/payments/`).
- Phase 12 (function EXECUTE hardening) is implemented:
  - Migration `20260101000041_function_execute_hardening.sql` makes the `EXECUTE` surface
    default-deny: it revokes `EXECUTE` from `PUBLIC` **and** from `anon`/`authenticated` on every
    `public` function, re-grants `service_role`, and re-grants only the deliberate browser-callable
    functions to `anon`/`authenticated`. It also redefines `review_listing_submission` with the
    `is_real_estate_admin()` guard it was missing. See the gotchas below.
  - `supabase/validate/30_function_execute_hardening.sql` asserts the *subset* property — no
    non-trigger `public` function is executable by a browser key unless it is on the allow-list —
    which is what makes a new, unclassified function fail the check.
  - `supabase/validate/00_supabase_shim.sql` now also creates the `storage.buckets` table the
    admin-console migration inserts into, so the harness builds from a clean database.
- Phase 13 (department-scoped "Work Done" authoring) is implemented:
  - Migration `20260101000042_department_project_editing.sql` adds `is_department_editor(slug)` and
    replaces the `is_admin()` write policies on `electrical_projects`, `project_media` and
    `electrical_project_services` with a department-scoped predicate, so a department's staff and
    admins can author their own finished work and no other department's. The service-link policy
    additionally requires the linked service to belong to the project's own department.
  - Content layer `src/lib/content/project-admin-queries.ts` (`departmentsForRole`,
    `listAdminProjects`, `loadProjectOptions`, `getAdminProject`) and `project-admin-actions.ts`
    (create/update/publish/delete, media upload/remove) plus `project-form-labels.ts`.
    `getAdminProject` is scoped to the departments the caller may author, so a guessed id for
    another department's published project 404s rather than opening a form the write policy refuses.
  - Admin console `src/app/(static)/admin/(console)/work/` (`page.tsx`, `new/page.tsx`,
    `[id]/page.tsx`) with `ProjectForm.tsx` and `ProjectMediaForm.tsx`.
  - `DEPARTMENT_EDITOR_ROLES` in `src/lib/auth/roles.ts` drives the admin nav entry, the page
    guards and the Server Action guards; `roles.test.ts` asserts it agrees with the SQL predicate.
  - The department hero gained a "Work Done" CTA (EN/FR) linking to `/{locale}/{department}/projects`,
    shown only for departments that have a projects surface.
  - Audit actions `project_created` / `project_updated` / `project_media_uploaded` /
    `project_media_removed` in `src/lib/security/audit.ts`; the never-emitted `project_published`
    was removed as dead code.
  - `supabase/validate/40_department_work_behaviour.sql` proves the department boundary, the
    published/draft visibility split, the child-row scope and the service-department rule.
- Phase 13 also carries the first security-audit fixes:
  - Migration `20260101000043_revoke_place_order_public_execute.sql` revokes the browser `EXECUTE`
    grant on `place_order` (Phase 12 had allow-listed it as "guest checkout"). The only caller is
    `submitCheckout`, which uses the service-role client, so the grant was pure attack surface: a
    `SECURITY DEFINER` write that bypasses RLS and authorizes a cart by id alone. `service_role`
    keeps the grant; checkout is unchanged. `30_function_execute_hardening.sql` now asserts the
    revoke instead of the grant.
  - Migration `20260101000044_project_and_inquiry_storage_buckets.sql` declares `project-media`
    (public, 5 MiB) and `inquiry-attachments` (private, 10 MiB) as schema. Both were only in
    `supabase/config.toml`, so a hosted project had no such bucket and every project-photo and
    inquiry-attachment upload failed. `supabase/validate/50_storage_bucket_behaviour.sql` asserts
    the visibility split and the limits.
  - `uploadProjectMediaAction` validated with `kind: "property-image"` (10 MiB) while writing to the
    5 MiB `project-media` bucket; it now uses the purpose-built `project-image` kind.
  - Audit figures on a fresh database (43 migrations): 50 public tables, all 50 with RLS enabled
    and at least one policy; 45 `SECURITY DEFINER` functions, every one with a pinned
    `search_path`; `place_order`, `apply_payment_result`, `cancel_order` and the other privileged
    RPCs reachable by `service_role` only.
- Resend transactional email is wired into the inquiry, quote-request and order-confirmation paths
  (`src/lib/email/send.ts`), gated on `isEmailConfigured()` so an unconfigured deployment reports
  `unconfigured` rather than pretending to send.
- 765 Vitest tests pass, `tsc --noEmit` is clean, ESLint is clean, and the production build
  succeeds. The `supabase/validate/*.sql` scripts pass on a fresh Postgres 17 database (43
  migrations).

### Phase 13 gotchas worth not rediscovering

- **The console page guard is a message, the write policy is the control.** `requireEditor` and
  `departmentsForRole` run in the Server Action so the editor sees "not your department" instead of
  a raw policy violation, but a department editor's real boundary is the RLS policy from
  `20260101000042_department_project_editing.sql`. The row writes deliberately use the cookie-bound
  client (never the service-role client) so that policy is what refuses a cross-department write.
- **`getAdminProject` must be scoped, not just the list.** The public select policy makes another
  department's *published* project world-readable, so a guessed id would otherwise open an edit
  form whose save the write policy then refuses. Scoping the detail read to
  `departmentsForRole(role)` turns that into a 404, so the page and the database agree.
- **A comment that promises a constraint is not the constraint.** The department-scoped write policy
  on `electrical_project_services` initially checked only that the *project* was in an editable
  department, while the migration comment said services were scoped too. Nothing in the schema ties
  `service_id`'s department to the project's, so a crafted POST could link an Electrical Services
  service to a Digital Marketing project; the console's picker was only a UI filter. The policy now
  joins `services` and requires `s.department_id = p.department_id`, and
  `40_department_work_behaviour.sql` proves both the accepted and the refused link. When a comment
  claims a boundary, implement it in the policy or delete the claim.
- **An allow-list entry is a claim about the *caller*, so verify it against the code, not the
  function's name.** `place_order` sat on the Phase 12 browser allow-list as "guest checkout" on the
  assumption the storefront called it through the publishable key. It does not: the only caller is
  `submitCheckout`, which uses the service-role client, so the grant only widened the surface of a
  `SECURITY DEFINER` write that authorizes a cart by id alone and takes a caller-supplied
  `p_customer_id`. Before granting a function to `anon`/`authenticated`, grep for its `rpc(` call
  sites and check which client each one holds (`createAdminClient` vs the cookie-bound or public
  client), and ask whether the function's *internal* authorization is real.
- **A bucket declared only in `supabase/config.toml` does not exist in production.** `config.toml`
  is local-dev tooling; a hosted project gets its buckets from `storage.buckets`. Migration 37 moved
  four buckets into the schema for exactly this reason but omitted `project-media` and
  `inquiry-attachments`, so the project-photo and inquiry-attachment uploads would have failed on
  any real deployment while passing every local check. Add a bucket to `supabase/migrations/`, not
  just to `config.toml`. `supabase/validate/50_storage_bucket_behaviour.sql` asserts the two now
  exist and that `inquiry-attachments` (a visitor's own photographs) is private.
- **An upload validator's `kind` must match the bucket it writes to.** `uploadProjectMediaAction`
  passed `kind: "property-image"` (10 MiB) while uploading to the 5 MiB `project-media` bucket, so a
  6-10 MB file passed the application check and was then refused by the bucket with a generic
  failure. The purpose-built `project-image` kind (`MAX_PROJECT_IMAGE_BYTES`, the same accepted
  types) had existed since Phase 5 and was unused. Check the bucket's `file_size_limit` and
  `allowed_mime_types` against the `kind` before wiring an upload path.
- **A `project_published` audit action with no emitter is dead code.** Publishing happens through
  `publishState` on create/update, which already emits `project_created` / `project_updated` with the
  state in metadata. Do not add an action name until a code path actually records it.
- **Pre-existing format debt is not yours to fix in a feature PR.** `src/lib/admin/navigation.ts`
  and `src/lib/auth/roles.test.ts` already failed `prettier --check` before this phase. Running
  `prettier --write` on them adds unrelated reformatting churn to a feature diff; make the minimal
  edit by hand and leave the pre-existing debt alone.
- **A file's *encoding* is part of the diff, and a byte-level fix can corrupt unrelated characters.**
  An em-dash written through the editor landed as a lone `0x97` byte, and a naive
  `replace(b"\x97", ...)` then also hit the `0x97` inside `●` (U+25CF = `E2 97 8F`), corrupting
  every bullet in the file. Repair by rewriting the *whole* mis-encoded sequence
  (`\xe2\x80\x94`) rather than a single byte, verify with `python3 -c "...decode('utf-8')"`, and
  prefer plain ASCII in new doc prose.

### Phase 12 gotchas worth not rediscovering

- **Supabase grants function `EXECUTE` to `anon` and `authenticated` *by name*, not through
  `PUBLIC`.** `REVOKE ALL ON FUNCTION ... FROM PUBLIC` removes only the `=X` ACL entry; the
  `anon=X` and `authenticated=X` entries survive, so every function stays callable from a browser
  key. Supabase's own guidance is to revoke from *both* `public` and the role. The first revision
  of migration 41 revoked from `PUBLIC` alone and so secured nothing — and its assertion only
  checked the named privileged functions, which still held their per-role grants, so it passed.
  The migration now revokes from `anon, authenticated` explicitly, and the assertion is a *subset*
  check (nothing reachable is outside the allow-list) rather than a deny-list. Reproduce the
  difference against a clean database before trusting a grant migration; the ACL is
  `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}` after a plain
  `REVOKE ... FROM PUBLIC`.
- **Postgres checks `EXECUTE` for RLS policy functions, CHECK constraints, column defaults and
  stored generated columns — but *not* for trigger functions.** A blanket revoke therefore breaks
  browser writes in three non-obvious places and leaves triggers working:
  - role predicates used inside RLS policies (`is_admin`, `is_real_estate_admin`,
    `current_agent_id`, `inquiry_is_for_agent_listing`, …) — without them the table becomes
    unreadable for the role the policy is evaluated as;
  - helper functions in CHECK constraints (`gtin_is_valid`, `publish_state_is_consistent`) and
    column defaults (`generate_listing_reference`);
  - helper functions inside a **stored generated column** (`immutable_array_to_string` in
    `property_listings.search_vector`) — this one is the easiest to miss because the dependency is
    in the column expression, not a constraint.
  Enumerate these from `pg_proc`/`pg_attrdef`/`pg_constraint`/`pg_index` rather than by eye, and
  allow-list them in the same migration that revokes.
- **`review_listing_submission` was `SECURITY DEFINER` with no internal role check.** It publishes
  a listing, and the only check was the Server Action's `authorize()` — which a direct PostgREST
  call never runs. The application calls it with the *session* client (so `auth.uid()` attributes
  the reviewer), which means it must stay reachable by `authenticated`; the fix is the
  `is_real_estate_admin()` guard inside the function, not a revoke. The same predicate backs the
  `listing_submissions_write_admin` policy and `REAL_ESTATE_ADMIN_ROLES` in `src/lib/auth/roles.ts`.
- **`set_listing_private_details` and `set_listing_localized_slug` are `security invoker` on
  purpose**, so `listing_private_details` / `listing_slugs` RLS is the control (own listing for an
  agent, any listing for an admin). They need the `authenticated` grant to run at all, but a
  revoke-then-regrant must keep them or the admin form breaks.
- **The local validation harness needs a `storage` shim.** `20260101000037_admin_console.sql`
  inserts the media bucket definitions into `storage.buckets`, so a bare `00_supabase_shim.sql`
  fails the migration set with `relation "storage.buckets" does not exist`. The shim now creates
  the table. The `\set ON_ERROR_STOP` / `\i` psql meta-commands also have to be stripped when the
  scripts are driven through a non-psql client.
- **`psql` is not installed in this environment and the Docker socket is not reachable, but a
  Postgres 17 server is on `localhost:5432`.** The harness can be built and exercised with
  `psycopg2` (`pip install psycopg2-binary`): create a scratch database, apply the shim then the
  migrations in filename order, then run each `supabase/validate/*.sql` with the backslash lines
  removed. This is how the EXECUTE defect above was reproduced and fixed.

### Phase 7 gotchas worth not rediscovering

- **A `"use server"` module may only export async functions.** The directive turns every export
  into a callable endpoint, so a plain helper or a constant beside the actions passes `tsc` and
  every unit test and then fails the production build with "Server Actions must be async
  functions". Shared logic belongs in a module *without* the directive. `normalizeSearchQuery`
  lives in `search.ts` for exactly this reason. `src/lib/security/server-actions.test.ts` scans
  every `"use server"` file and rejects a non-async export.
- **A renamed route needs a redirect for its whole subtree, not just the index.** The browse
  surface moved from `/real-estate/properties` to `/real-estate/listings`, and the detail route
  moved with it — so `/real-estate/properties/:slug` has to redirect too, for the bare and the
  locale-prefixed forms. Redirecting only the index would leave every saved property link 404ing.
  `redirects.test.ts` pins all six.
- **Listing status labels are under `realEstate.statuses.<status>`, not `realEstate.search.*`.**
  `listingStatusLabelKey` returned `realEstate.search.status_${status}` while the labels live
  beside the other enum labels. The translator falls through to the raw key, so the filter panel
  rendered `realEstate.search.status_published` as visible text. A missing key is silent — it
  never throws.
- **Numeric filters must be truncated to integers.** Prices are `bigint`, counts `smallint` and
  areas `integer`, so `?minBedrooms=1.5` reaching the RPC is refused by PostgREST and becomes a
  failed request rather than a filter. `parsePositive` floors the value; `search.test.ts` pins it.
- **A per-customer page needs `export const dynamic = "force-dynamic"`.** `/real-estate/favorites`
  and `/real-estate/saved-searches` prerendered as static (`●`), which bakes in the signed-out
  redirect and serves it to everyone regardless of session.
- **Favourite and saved-search writes use the session client, never the service-role client.**
  The three tables restrict every row to `auth.uid() = user_id`, so the database is the control
  and the page guard is only for the experience. Using the admin client here would have made
  those policies decorative.
- **`saved_searches` is `unique (user_id, label)`.** A duplicate save is a distinct outcome, not a
  generic failure — "please try again" is advice that cannot work. Map Postgres `23505` to its own
  message rather than reporting every insert error as retryable.
- **The sign-in route is `/admin/login`, and its `next` parameter is Zod-validated.** It rejects
  anything not starting with a single `/`, so a customer returning from a save control lands back
  on the listings view.

### Phase 4 gotchas worth not rediscovering

- **The store lives under `/digital-marketing/store`, not `/store`.** It is that department's
  commercial surface, so it inherits the department accent scope via `departmentScopeProps`.
- **Both product URL segments are localized.** `/fr/.../store/ordinateurs/ordinateur-thinkpad-x1`
  and `/en/.../store/laptops/thinkpad-x1` are the same product. `resolveBySlug` matches the
  locale's own slug first and the canonical slug second, and `isCanonicalUrlSlug` tells the page
  when to `permanentRedirect` to the localized URL. Dropping the canonical fallback breaks
  inbound English links under `/fr`; dropping the locale scope creates two URLs for one product.
- **A product must belong to the category in its URL.** The detail page 404s on a mismatch.
  Without that check `/store/laptops/some-phone` renders a phone under a laptop heading.
- **Never take price or stock from the request.** `addToCartAction` re-reads both from the
  database, and `cart-actions` only accepts a product id and a quantity. A posted price is not
  evidence of anything.
- **XAF has no minor unit.** `minorUnitDivisor("XAF") === 1`. Assuming two decimals renders
  850000 FCFA as 8,500.00. `priceForFeed` emits a period decimal and no thousands separator
  because Merchant Center parses it that way.
- **The translation index is built by database triggers, not by application code.** Inserting a
  product fires `products_sync_translation_index` and enqueues the sync jobs. An action that
  assembled the index itself would leave any product written by another path untranslated.
- **Product SEO overrides live in `entity_seo`, never on the product row or in
  `content_translations`.** `products` has no `seo_title` / `seo_description` columns, and the
  product page reads its metadata from `entity_seo`. Writing SEO text anywhere else accepts the
  editor's input and silently never renders it. The `entity_seo` trigger
  (`entity_seo_sync_product_translation_index`) indexes the two keys once the row exists, so the
  admin action only has to upsert `entity_seo`.
- **`next start` does not work with `output: standalone`.** Use the standalone server, or run the
  dev server, when smoke-testing routes.
- **`NAV_PATHS` is the sitemap's source of truth.** Adding a nav link without adding its path
  there fails `navigation.test.ts` ("only links to paths the sitemap also advertises").
- **A translator function cannot be passed into a Client Component.** `createTranslator(locale).t`
  is a closure over the message dictionary, so the RSC serializer refuses it at render time:
  "Functions cannot be passed directly to Client Components unless you explicitly expose it by
  marking it with `use server`". The mistake typechecks, lints, builds and passes every other test —
  it only throws when the route is actually requested, so an empty data source (the usual pre-launch
  state) can hide it indefinitely. Client Components therefore take a serializable `locale` prop and
  call `createTranslator(locale).t` themselves; the translator is pure and isomorphic, so the two
  forms render identically. `src/lib/i18n/client-boundary.test.ts` enforces the rule by scanning for
  `t: Translator["t"]` in a `"use client"` file and for `t(` without a `createTranslator` import.

### Phase 3 gotchas worth not rediscovering

- **`next.config.ts` cannot import application modules.** It is transpiled standalone before the
  `@/` alias exists, so importing `@/lib/config/navigation` fails the build with
  `Cannot find module './src/lib/config/site'`. Redirect tables live in `src/lib/config/redirects.ts`,
  which may only reach leaf modules by *relative* path (`../i18n/locales` is a pure data module with
  no imports of its own). `navigation.ts` re-exports from it for app code.
- **A renamed route needs a redirect for the locale-prefixed URL, not just the bare one.** Phase 2
  linked to the section as `/${locale}/blog`, so `/en/blog` and `/fr/blog` were live, indexable URLs.
  Redirecting only `/blog` left both returning 404 — the bare path looked fixed while every real
  inbound link was broken. `redirects.test.ts` pins all locale variants.
- **Nested dynamic routes must be under the existing `[department]` segment.** Adding a parallel
  static `src/app/(site)/[locale]/digital-marketing/` directory shadows `[department]` and splits
  the department across two page components. `.../[department]/services/[service]` is the correct
  shape for `/[locale]/digital-marketing/services/seo`.
- **A page module may only export the Next.js-recognised names.** Exporting a helper (e.g. a
  `formatDate`) from `page.tsx` fails the build's route type check. Shared helpers live in
  `src/lib/content/format.ts`.
- **Article bodies are rendered as React elements, never `dangerouslySetInnerHTML`.** `RichText`
  escapes raw HTML and refuses to make a non-http(s) link clickable, so `<script>` written into an
  article displays as text and `javascript:` URLs are not clickable. Tests in
  `RichText.test.tsx` pin both behaviours.
- **`noUncheckedIndexedAccess` is on.** Regex capture groups (`match[1]`) are `string | undefined`
  and array indexing (`records[0]`) is `T | undefined`. Assert with `!` only where the pattern
  guarantees the group; otherwise narrow.
- **Content surfaces gate on published content, not on the department existing.** `departmentHasServices()`
  decides whether a department exposes `/services` and `/portfolio`, so `electrical-services` and
  `real-estate` 404 on those paths and are absent from the sitemap until their phase lands. The URL
  scheme does not change when they do.
- **The portfolio and insights surfaces render honest empty states.** There is no case-study or
  article content in the brief, so nothing is invented to fill them. The database enforces the
  client-approval rule (`case_studies_publish_requires_client_approval`) that makes a published case
  study safe to claim.
- **Sitemap articles are data-driven and the route is `async`.** `sitemap()` awaits `loadInsights`,
  which returns `[]` when Supabase is unreachable, so a database outage degrades the sitemap instead
  of failing it.


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
- **Public content loaders must use `createPublicClient()`, never the cookie-bound `createClient()`.**
  `createClient()` calls `cookies()`, which makes every page that reads through it dynamic. On a
  route with `generateStaticParams` (project and store detail pages) Next 16 then refuses the static
  params, the loader's fallback silently swallows the failure, and the build prerenders nothing —
  so every detail URL 500s at request time with "Page changed from static to dynamic at runtime".
  The symptom is invisible in unit tests, which never exercise prerendering. `createPublicClient()`
  is stateless and anonymous, which is the correct access level: RLS already limits it to published
  rows, and the loaders additionally filter `publish_state = 'published'`. `loadCategoryOptions()`
  is the deliberate exception — it backs the admin product form and must see unpublished categories,
  so it keeps the session client. `src/lib/supabase/public.test.ts` pins this split.

### Phase 2 gotchas worth not rediscovering

- **The nav model is shared, not per-surface.** `buildPrimaryNav` in `src/lib/config/navigation.ts`
  produces a discriminated `link | menu` union consumed by the desktop header, the mobile drawer and
  the sitemap. Do not rebuild the nav inline in a layout again: the previous inline version could
  not be unit-tested and made it easy to list a route in one surface but not another. `NAV_PATHS`
  and the sitemap are wired together so a new entry cannot be added to the header and forgotten in
  the sitemap.
- **`/services`, `/gallery` and `/blog` sit beside the `[locale]/[department]` dynamic segment.**
  Static segments win over dynamic ones in the App Router, so these resolve correctly — but any new
  top-level localized route must be checked against the department slug list, because a slug added
  later with the same name as a static route silently shadows it.
- **Do not fill `/gallery` or `/blog` with placeholder content.** The brief lists only corporate
  facts; project photos and articles were never supplied. Stock imagery, invented captions or
  lorem-ipsum posts under the company name misrepresent real work. Both pages state plainly that
  nothing is published yet. When real content arrives, `BlogPosting`/author/`datePublished`
  structured data must accompany it — emitting it against empty content is structured-data spam.
- **The Departments dropdown keeps its panel mounted and hides it with CSS** (`visibility`, not just
  `opacity`). Unmounting it would remove three indexable department links from the DOM. Hover is
  scoped under `@media (hover: hover)` on purpose: scoping it positively rather than resetting it
  under `hover: none` avoids a specificity clash where a tap on a touch screen sets `:hover` and
  cancels a panel the user explicitly opened.
- **The desktop nav only appears from `xl`.** Seven entries plus the language switcher and the
  account action crowd at `lg`; the drawer is used below `xl`. The breakpoint on the desktop block
  and on the drawer trigger must stay in sync (`xl:block` / `xl:hidden`), or both render at once.
- **The header row is a three-column grid, not `justify-between`.** With `justify-between` the nav
  sits midway between the logo and the account action, so it lands off the page centre by half the
  difference between those two widths. Equal `1fr` side columns (`grid-cols-[1fr_auto_1fr]`) hold
  the nav on the true centre and pin the logo and action to the same content edges as the rest of
  the page. The row also shares `container-page`, so the bar lines up with page content.
- **The header fits inside a fixed 1168px content budget, and French is the binding case.** The
  container is capped at `78rem`, so the content width stops growing at 1280px while the French row
  is the widest (its labels are longer). At one point the French bar needed 1326px and so overflowed
  at every viewport; nav padding (`px-1.5`) and the row gap (`gap-4`) are what keep it inside. Before
  widening nav spacing, changing `container-page`, or adding a nav entry, re-measure French at
  1280px — English passing means nothing, since English has ~50px more slack.
- **Nav links and the dropdown trigger must share one box model** (`inline-flex items-center
  whitespace-nowrap`). As flex items they shrink below their text width and wrap without
  `whitespace-nowrap`, and an `inline` box reports a shorter rect than an `inline-flex` one — either
  one puts a single item on a different baseline from the rest of the bar.
- **The language switcher abbreviates to `EN`/`FR` in the header.** The full names cost ~60px more
  in French and are what pushed the bar past its budget. The abbreviation is visual only: the link
  keeps `LOCALE_LABELS` as its `aria-label`, so the accessible name is still the full language.
- **`@testing-library/user-event` is not installed.** Component tests use `fireEvent` from
  `@testing-library/react`. Do not add the dependency just for a test without a reason.
- Next 16 emits `hrefLang` (camelCase) in prerendered HTML; HTML attribute parsing is
  case-insensitive, so `hreflang` alternates are correct. A lowercase `grep hreflang` on raw HTML
  returns zero and looks like a bug — it is not.
- **A page title that already contains the brand name must be `title: { absolute: ... }`.** The root
  layout applies a `%s | <legal name>` template, so a literal string title renders the brand twice
  ("KC Technology Corporation | KC Technology Corporation"). `buildMetadata` handles this
  automatically for titles containing `SITE.legalName`; static `metadata` exports must set
  `absolute` by hand.
- **Verify rendered HTML, not just source.** Several defects across these phases — duplicated titles,
  a stale `theme-color`, three department cards sharing one accent, nav order — were invisible in the
  code and only showed up in `curl` output. Prerendered HTML is the ground truth.
- **A photo behind hero copy needs a scrim, and the contrast must be measured, not assumed.** Hero
  backdrops go through `HeroMedia` (`src/components/ui/HeroMedia.tsx`), which layers the image plus
  the `.hero-scrim` utility from `globals.css`. The scrim is weighted to the inline-start edge where
  copy sits on desktop.
- **Measure the glyph runs, not the element box.** Checking a heading band by sampling a fixed
  rectangle reports failures that no reader experiences: an 11px eyebrow is a full-width block whose
  text covers a small part of its own box, so the sample includes empty photo the glyphs never touch.
  Walk the element's `Range.getClientRects()` and sample those boxes. Two of the "failures" in the
  first pass at this hero were artefacts of box-sampling.
- **An element with its own background is not on the photo.** The hero CTA is an opaque pill on
  `bg-dept-accent`; comparing its label against the photo behind the pill gives 2.0:1 for every
  department. Compare a label against its own background when one is set.
- **Set the scrim against the actual image, and check it at 1024px too.** These stops suit dark
  photography (headline-band luminance 0.05–0.26 before the scrim). Lighter images need the left and
  middle stops raised back toward 0.9. The 1024px width matters: it is inside the `md` container
  where the copy column is still narrow but the scrim gradient is already the desktop one, and it is
  where the breadcrumb lands near the start of the gradient. Tune on 1440 *and* 1024.
- **On narrow viewports the scrim must be vertical.** Below `1023px` the hero copy runs edge to edge
  and stacks from ~10% to ~90% of the hero, so a rightward taper leaves the wrapped line ends over
  open photo. The mobile rule in `globals.css` flattens the gradient and strengthens it downward.
- **Hero images are per-department data, not a hardcoded path.** Each entry in `DEPARTMENTS`
  (`src/lib/config/site.ts`) carries `heroImage`, and the shared department page renders
  `definition.heroImage`. `src/lib/config/hero-images.test.ts` asserts every path resolves to a
  complete JPEG under `public/hero/`; a mistyped path otherwise fails silently as an empty box. The
  original assets were 246×113 placeholders — valid JPEGs that passed those checks — so the test now
  also asserts a minimum width and a landscape ratio, and covers `/hero/corporate.jpg`, which is
  referenced by path from two pages rather than from `DEPARTMENTS`.
- **PR hygiene: check the target PR is still open before pushing to its branch.** Phase 7 was already
  merged to `main` via #14, and pushing a follow-up commit onto the merged
  `phase-7-real-estate-platform` branch silently reopened work on a dead branch. Cut a fresh branch
  from `main` instead, and restore any branch you pushed to by accident.
- **A `next build` does not populate `public/` or `.next/static/` in the standalone bundle, and a
  silent copy failure makes the whole site render unstyled.** `output: "standalone"` emits only
  `server.js`, `package.json` and `node_modules`; the assets must be copied in:
  `cp -r public .next/standalone/public && mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/static`.
  Miss it and every `.css`, `woff2` and `public/` request 500s from the standalone server — the page
  still returns 200 HTML, so it looks like a styling bug rather than a missing-file bug. After
  starting the server, assert the assets rather than trusting the HTML status:
  `curl -o /dev/null -w '%{http_code}' localhost:12000/_next/static/chunks/<name>.css` (200, not 500).
- **Verify a claimed page break by reading computed styles, not by looking at a screenshot.** The
  CSS-500 above was only caught by evaluating `getComputedStyle` on the running page and by checking
  each asset's status code. A screenshot alone cannot distinguish "unstyled" from "intentionally dark
  design", and it is easy to misread a dark hero band as a broken page. Check `document.styleSheets`
  rule count, the header's `position`/`backgroundColor`, and each `img`'s `naturalWidth` (0 = the
  file did not load).
- **A `backdrop-filter` ancestor silently breaks `position: fixed` children.** `Modal` is rendered
  from inside `SiteHeader`, which carries `backdrop-blur`. A `backdrop-filter` on an ancestor makes it
  the containing block for fixed descendants, so the drawer layer's `inset-0` resolved against the
  64px header instead of the viewport: the backdrop covered the page while the panel sat inside the
  header box. `Modal` now portals to `document.body` to escape that ancestor. Any new overlay gets
  the same treatment — do not assume `fixed inset-0` reaches the viewport.
- **A drawer's width must be pinned in absolute units, not viewport-relative.** `w-[min(22rem,92vw)]`
  measured 345px at a 375px viewport — 92% of the screen — which reads as a full-screen takeover
  rather than a drawer. The panel is now a flat 300px with an `82vw` cap, so the page stays visible
  beside it down to 320px.
- **Hero assets are resolution-capped by the source, and that cap is invisible in the markup.**
  `next/image` never upscales, so a `w=2048` request returns the source width and no error. The
  original assets were 246×113 placeholders and the next round were 736px Pinterest thumbnails,
  stretched full-bleed. `corporate` (992px) and `real-estate` (626px) are still capped and need
  genuinely larger source images — confirm a source exceeds `1920px` before wiring it in. Replacing a
  hero file in place also leaves the URL unchanged, and Next serves optimised images with
  `max-age=14400`, so the old bytes linger for hours; ship a new filename instead.
- **A local branch whose tip is already merged is not a safe base.** `phase-8-payments-orders-crm`
  sat on a commit that `main` had already absorbed via #16, so `git status` looked clean and the
  branch looked current, but a PR opened from it would have carried nothing. Check with
  `git merge-base --is-ancestor <branch> origin/main` before building on a branch, and cut fresh
  from `origin/main` when it returns true.
- **`order_events.event_type` is constrained to `^[a-z][a-z0-9_]*$`.** A dotted name like
  `payment.manual_recorded` is plausible and reads well, but the check rejects it at insert time —
  which only surfaces on the manual-payment path, not in any test that stops before the write. Use
  `payment_manual_recorded`.
- **The checkout schema reports stable codes, not sentences.** The form must map a field to its
  message key (`CHECKOUT_ERROR_KEYS`); interpolating the raw code put `consentRequired` in front of a
  customer.
- **A successful Server Action must `redirect()`, not hand a success state back for the client to
  act on.** `submitCheckout` cleared the cart cookie and revalidated before returning
  `{ status: "ready" }`. The cleared cookie made the checkout route re-render into its empty-cart
  branch, which unmounted `CheckoutForm` before its `useEffect` could `router.push` to the
  confirmation — so a real order was created while the browser stayed on a page reading "Your cart is
  empty". The order existed and the cookie was set, which makes this look like a routing bug rather
  than a missing navigation. Call `redirect()` from the action; Next.js turns it into the action
  response, and it works with and without JavaScript.
- **A Server Action that mutates a cookie the same route reads will re-render that route before any
  client effect runs.** Any post-action navigation designed as a client `useEffect` on the returned
  state is racing an unavoidable re-render. Prefer the server-side redirect for the success path.
- **Test the JSON and the no-JS paths separately, with a real browser.** `curl`-style POSTs with a
  hand-rolled body produced `Connection closed` / HTTP 500 and created no order — an artifact of the
  request, not the app. Driving a real browser (and one with `setJavaScriptEnabled(false)`) is what
  showed the order was placeable and only the redirect was missing. A harness click is also not proof:
  reproduce with `page.mouse.click`/`page.type` before concluding the app is broken.

- **Regenerating `database.types.ts` from the live schema can surface long-dormant nullability.** The
  hand-maintained types had drifted; a generated column (`order_items.line_total_minor`) types as
  nullable even though its expression never yields null. Existing mappers then stop compiling. Fix
  the mapper (`row.line_total_minor ?? row.unit_price_minor * row.quantity`) rather than loosening the
  consumer's contract, and re-check every file that reads a regenerated table.
- **`.next/dev/types/validator.ts` is stale after a route group move, and it breaks `next build`.**
  Moving pages under a `(console)` group left the generated validator requiring the old
  `src/app/(static)/admin/<route>/page.js` files, so the build failed type-checking on files that do
  not exist. `rm -rf .next` regenerates it. `npx tsc --noEmit` on its own will not catch this if the
  stale file is excluded.
- **The i18n parity test splits keys on dots, so a literal `"state.draft"` key is read as nested.**
  It reduces the tree by each segment, hits `undefined`, and throws `Cannot read properties of
  undefined`. Message keys with a dot must be nested objects (`state: { draft: ... }`), not flat keys.
- **The admin sidebar's active-link check must not use `startsWith` for `/admin` alone**, or the
  dashboard entry stays highlighted on every console route. `isNavItemActive` special-cases `/admin`
  to an exact match and uses `href + "/"` boundaries elsewhere so `/admin/logs` does not match
  `/admin/logs-archive`.
- **A server-mutating action needs `revalidatePath` on both the list and, when one exists, the detail
  route.** Revalidating only `/admin/content` leaves the article's own edit page serving the old row.
- **Client-code animation state must never reach the server HTML.** The scroll reveal works because
  the resting state is the *visible* one: the component adds `data-reveal="pending"` in a `useEffect`,
  so a crawler, a no-JS visitor and the pre-hydration paint all get full-opacity markup with no
  attribute. Setting the offset state during render instead would emit `data-reveal="pending"` in
  `en.html` and publish an invisible block. Verify by grepping the built HTML, not by eyeballing the
  page in a browser — `grep -c data-reveal .next/server/app/en.html` must be `0`.
- **A reveal wrapper must render the semantic element itself (`as="li"`), not a `<div>`.** A `<div>`
  between `<ul>` and `<li>` is invalid markup, and it also moves the `data-department` accent scope
  off the grid item that the department CSS targets, so the accent silently stops applying.
- **Legal clause ids are a cross-locale contract.** Terms and Privacy keep identical section ids in
  English and French so a language switch lands on the same clause; the test asserts en↔fr parity
  rather than just uniqueness within a document.
- **`getSiteContent()` is `async` and hits `site_settings`; tests that only need the layout use the
  synchronous `FALLBACK_SITE_CONTENT` constant.** `SiteFooter` also takes `departmentLabels` as a
  required prop, so a footer test must supply it or it throws on `department.slug`.
- **Pre-existing lint/format debt is not yours to fix in a feature PR.** On this repo `eslint .`
  reports an unused `MAX_PRODUCT_IMAGE_BYTES` in `src/lib/store/media-actions.ts`, and
  `prettier --check` flags `RichText.tsx`, `RichText.test.tsx`, and `globals.css`. Confirm against
  `git stash`/HEAD before assuming a clean-up belongs in your diff.

- **`src/proxy.ts`'s `config.matcher` must stay a static string literal.** Next.js parses it at
  compile time and fails the build with "Entry `matcher[0]` need to be static strings or static
  objects" if it is a computed value, so it cannot be generated from
  `NON_LOCALIZED_EXACT_PATHS` / `NON_LOCALIZED_EXTENSIONS` in `src/lib/i18n/routing.ts`. Those
  exports are the declared intent; `src/proxy.test.ts` asserts the real literal against them, which
  is what keeps the two in step. Add a root metadata route (like `manifest.webmanifest`) to both.
- **Emulate the matcher correctly when testing it.** The pattern is `/((?!…).*)`, so the leading `/`
  is consumed *before* the lookahead: test `/_next/static` as `_next/static`. Passing a
  slash-prefixed path makes every literal exclusion fail to match, leaving only the extension list
  doing any work and hiding a broken test behind passing assertions.
- **Don't put an `aria-label` on the logo lockup.** It renders `shortName` below `sm` and
  `legalName` at `sm` and up, and `label-content-name-mismatch` reads the DOM, so any hard-coded
  label omits the other breakpoint's visible text. Let the accessible name come from the link's
  content. `aria-hidden` on the subtitle does not help — visible text must still be in the name.
- **Lighthouse's default Lantern throttling overstates LCP on this app.** It reported mobile
  performance 84 / LCP 4.2s while the page observed LCP at 514ms and the LCP phases summed to
  ~490ms; with `--throttling-method=devtools` mobile was 98 / LCP 1.67s. Use applied throttling
  before chasing a simulated LCP regression.

### Phase 12 gotchas worth not rediscovering

- **Supabase grants `EXECUTE` on every new `public` function to `anon` and `authenticated` by
  default, and a `SECURITY DEFINER` function runs as its owner.** That combination turned
  `apply_payment_result` (mark any order paid), `cancel_order`, `import_administrative_divisions`
  and `review_listing_submission` (publish a listing) into browser-callable RPCs with RLS bypassed.
  `20260101000041_function_execute_hardening.sql` revokes from `PUBLIC` schema-wide, re-grants
  `service_role`, and re-grants only the deliberate public RPCs (`place_order`,
  `search_property_listings`, the role predicates RLS policies call, …). **A new function gets the
  default grant again**, so any future migration that creates one must classify it in the same
  migration — the assertion at the end of the hardening migration is what catches a miss.
- **The default grant is invisible to TypeScript and to every unit test.** The RPC wrapper only
  checks the response shape; only a `has_function_privilege`/`set role` probe against a real
  database sees it. That is why the proof lives in `supabase/validate/30_function_execute_hardening.sql`
  rather than in Vitest.
- **A hardcoded `script-src` that omits Google blocks the analytics script at runtime with no
  visible error.** `gtag.js` is injected after consent, so a blocked load never appears in the page
  source or in any test — the measurement layer just reports nothing. The CSP now adds
  `googletagmanager.com` to `script-src` and the GA beacon hosts to `connect-src` only when
  `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set.
- **An unconfigured external service must be reported, never simulated.** `src/lib/email/send.ts`
  returns `{ ok: false, error: "unconfigured" }` when `RESEND_API_KEY` or `EMAIL_FROM` is absent,
  and `{ ok: false, error: "send_failed" }` on a provider error or a thrown network error — it never
  throws into the request that triggered the notification. `send.test.ts` pins both, plus HTML
  escaping of visitor input.

See `docs/PROJECT_BRIEF.md` for the phase roadmap and the exact next step.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
