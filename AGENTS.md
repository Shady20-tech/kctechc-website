# AGENTS.md — KC Technology Corporation Website

Persistent project memory for any agent (OpenHands or otherwise) working in this repository.
Read this file first, then `docs/PROJECT_BRIEF.md` for the full business/product brief and the
phase roadmap. Keep both files synchronized with the specification as the build progresses.

---

## 1. What this project is

KC Technology Corporation corporate website plus three department experiences under one brand:

| Department                                 | Public localized path           | Accent           |
| ------------------------------------------ | ------------------------------- | ---------------- |
| Corporate gateway (root, language-neutral) | `/`                             | Brand ink / teal |
| Digital Marketing (store)                  | `/{locale}/digital-marketing`   | `#0066CC`        |
| Electrical Services                        | `/{locale}/electrical-services` | `#C2410C`        |
| Real Estate                                | `/{locale}/real-estate`         | `#1E5631`        |

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

- **The site takes no payment itself, and no longer integrates a payment provider.** Fapshi was
  removed. An order records the customer's chosen _method_ as an intent only
  (`mobile_money_mtn`, `mobile_money_orange`, `bank_transfer`, `cash_on_confirmation`); the order
  is emailed to the business (`ORDERS_NOTIFY_TO`, else `SITE.emails`) and the team contacts the
  customer to confirm stock, delivery and final payment (MTN/Orange Mobile Money, bank transfer, or
  as agreed). `card` remains a valid _stored_ enum value for legacy rows but is never offered.
- **Never fake a successful payment.** There is no automated charge, so nothing may present an
  order as paid. `pending_payment` is the state of every placed order until a staff member records
  a received payment (`recordManualPayment`), which writes the `payments` row (`provider='manual'`)
  and advances the order. The customer confirmation email says the order is _awaiting confirmation_,
  never that it is paid.
- Bank transfer and mobile money are settled manually/offline; the recorded method is intent, and
  the admin notification labels it as such so it is not mistaken for money received.

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
is behind it, and the worst case is the sticky header at scroll 0 sitting over the _white_ page, not
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
- Phase 4 of the marketplace work (the Jiji-style redesign of the real-estate browsing experience)
  is implemented and audited end to end:
  - `/[locale]/real-estate` is a marketplace front door, not the shared department template: a
    prominent search area (seeded region selector + keyword + submit, as a plain GET form so the
    search *is* a URL and works without JS), eight category shortcuts built from the same
    `PROPERTY_CATEGORIES` model the sidebar uses, then real inventory only (category counts from
    `listing_facets`, a trending strip from recorded view counts, featured, recent, region index).
    The heading is "Find the Right Property in Cameroon". Nothing is invented to fill it.
  - `/[locale]/real-estate/listings` is a two-column results layout: a collapsible filter sidebar
    (17rem at `lg`, 18rem at `xl`, i.e. 272-288px, inside the brief's 250-300px band) and the
    results area taking the remainder. Below `lg` the sidebar is replaced by a modal drawer with a
    visible Filter button that carries the active-filter count.
  - Sidebar sections, in order: keyword, property categories (with real counts), location
    (region -> division -> subdivision, each change clearing its children), price (min/max side by
    side with the brief's exact hint wording, currency stated, comparisons confined to one
    currency), characteristics (kind, class, bedrooms, bathrooms, areas, amenities), and verified
    publishers.
  - The toolbar shows the total, the current location and category, a sort control (relevance,
    newest, price asc/desc, most viewed), a list/map toggle and the save-search control. Active
    filters render as removable chips with a Clear All link that drops every filter.
  - Every result comes from the `search_property_listings` RPC; nothing is fetched wholesale and
    filtered in React. A filtered view is `noindex, nofollow` and canonicalises to the clean
    results URL; the unfiltered view is indexable with reciprocal `hreflang` + `x-default`.
  - Verified badges are a super-admin-only decision (`/admin/real-estate/verification`,
    `setPublisherVerificationAction`), written through the session client so the
    `real_estate_memberships_enforce_verification` trigger is the boundary. The copy states
    explicitly that the badge means KC Technology reviewed the publisher's identity and is **not**
    a government guarantee of land title.
  - Multi-image authoring is wired for all three audiences: `ProductMediaForm` (department admins),
    `DashboardMediaPanel` (landlords and agents, via the `(dashboard)` route group's
    `/[locale]/account/[dashboard]/[id]`), and the console's listing media form all post a batch of
    files to one Server Action.
  - Audited at 1440/1024/375: no horizontal overflow at any width (`scrollWidth === clientWidth`),
    the drawer opens with `aria-label="Filters"` and its count matching the active filters, and
    Apply/Clear both present. Lighthouse: SEO 100, accessibility 100 on both surfaces;
    best-practices reads 96 on the landing page **only** because the unreachable Supabase host
    returns 502 for listing photographs — an external outage, not a code defect (the listings page,
    which has no cards to load while the database is down, reads 100).
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
  - `supabase/validate/30_function_execute_hardening.sql` asserts the _subset_ property — no
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
- The chairman's letter (attributed to Engr. Clinton Kum Ngum, Founder & Managing Director) is
  published: the full letter on `/[locale]/about` and a condensed version on `/[locale]` and on the
  language-neutral gateway `/`, where it is rendered once per language with locale-qualified ids
  (`gateway-chairman-en`/`fr`, `gateway-index-en`/`fr`). A `SiteIndex` component lists every public
  destination. The portrait is a development placeholder at `public/brand/chairman-portrait.jpg`
  (1000x1250) and is asserted by `hero-images.test.ts` like the hero assets. i18n keys live under
  `about.chairman*` and `home.message*` / `home.index*`.
- 861 Vitest tests pass (63 files), `tsc --noEmit` is clean, ESLint is clean, and the production
  build succeeds (133/133 static pages).
- Staff-written insight articles are now indexed for translation. Migration
  `20260101000053_insight_translation_index.sql` adds the missing
  `sync_insight_translation_index` trigger (title/summary/body), writes the source and target
  `content_translations` rows, queues the Tolgee jobs, and backfills existing articles. Before it,
  `'insight'` was a valid entity type and the read path merged French, but nothing ever wrote it, so
  `/fr` silently served English. See "Insight article translation" below for what this does _not_ do.
- Account deletion is implemented for both audiences:
  - Migration `20260101000073_account_deletion.sql` adds `detach_and_archive_user_content(uuid)`
    (service-role only): it archives the listings the account owns, steps a `pending_review` one back
    to `draft` first because the direct transition is illegal, removes the account's `agent_profiles`
    row (which is `on delete set null` and would otherwise survive as a ghost), refuses the last
    active super administrator, and returns the avatar/KYC storage paths that must be purged.
  - `src/lib/auth/account-deletion-service.ts` is the single implementation both entry points call:
    cleanup RPC → `auth.admin.deleteUser` (which cascades the profile and its children) → best-effort
    object purge. Orders, inquiries and audit rows survive detached by design.
  - Customer surface: `DeleteAccountForm` on `/[locale]/account` posts to `deleteOwnAccountAction`,
    which takes the account id from the **session** (never the form), requires the typed
    `DELETE_ACCOUNT_CONFIRMATION`, rate-limits, audits `profile_deleted` with `self: true`, signs out
    and redirects to `?reason=deleted`.
  - Admin surface: `DeleteUserForm` in each `/admin/users` row posts to `deleteUserAccountAction`,
    super-admin only, requires a recorded reason, refuses self-deletion, and reports an unknown id as
    `not_found`.
  - `supabase/validate/150_account_deletion_behaviour.sql` proves the archive scope, the cascade
    split, the last-super-admin guard and the EXECUTE classification on a fresh database.
- 1430 Vitest tests pass (113 files), `tsc --noEmit` is clean, ESLint is clean, and the production
  build succeeds (137/137 static pages).
- Two defects found while smoke-testing the marketplace against a real local Supabase stack, both
  fixed:
  - **The product gallery was a dead control.** `ProductGallery` rendered every uploaded thumbnail
    and never swapped the main image, so a product's second and later photographs could not be
    viewed. It is now `src/components/store/ProductGallery.tsx`, a `"use client"` module mirroring
    `ListingGallery` (`useState` + `aria-current` + active accent border), while
    `ProductImageFrame.tsx` stays a Server Component so the card does not pull in a client boundary.
    `ProductGallery.test.tsx` (6 tests) fails when the click handler is removed.
  - **The store category route answered 500 in the production build.** `[category]` is an uncovered
    dynamic param (its set is data) and the page awaits `searchParams`, which throws
    `DYNAMIC_SERVER_USAGE` at request time. Dev served it fine and the build printed `●` with no
    warning, so it was only visible from the standalone server — Lighthouse surfaced it as
    `errors-in-console` on the product page, which prefetches its category. Fixed with
    `export const dynamic = "force-dynamic"` on that route.
- 1460 Vitest tests pass (116 files). Lighthouse with applied throttling across `/en`, `/fr`,
  `/en/real-estate/listings`, a listing detail, the store index, a product detail and
  `/en/electrical-services`: accessibility, best-practices and SEO are **100** on every surface;
  performance measures 89-97. No horizontal overflow at 320/375/768/1440 on the marketplace, listing
  detail or product detail.
- KYC verification (Phase 2 of the real-estate work) is implemented:
  - Migration `20260101000060_kyc_verification.sql` creates `real_estate_kyc_applications`,
    `real_estate_kyc_documents`, `real_estate_kyc_review_events` and `listing_legal_documents`,
    the `kyc_*` enums, the `kyc-documents` private bucket, and `approve_kyc_application` — the one
    function that writes a capability. Migration `20260101000061_signup_account_type.sql` adds
    `profiles.declared_account_type` + `date_of_birth`, the `account_type` enum, and the age gate.
  - The applicant surface is `/account/kyc` (`KycApplicationForm`, `KycDocumentUpload`); the
    super-admin console is `/admin/real-estate/kyc` and `/admin/real-estate/kyc/[id]`
    (`KycReviewPanel`).
  - **A user-selected account type never grants privilege.** `declared_account_type` is a
    declaration only; no RLS policy reads it, and `kyc.test.ts` scans every policy in the schema to
    assert that. A capability exists only when `approve_kyc_application` (super-admin +
    service-role only) writes `real_estate_memberships.status = 'approved'`.
  - `isKycReviewerRole` (`KYC_REVIEWER_ROLES = ["super_admin"]`) is deliberately narrower than
    `isRealEstateAdminRole`; `roles.test.ts` asserts it matches `is_super_admin()` in the SQL.
- Landlord and agent dashboards (Phase 3 of the real-estate work) are implemented:
  - Migration `20260101000062_owner_listing_workflow.sql` pins a non-administrator listing to
    `source = 'owner_submission'` (closing a self-publish hole — see the gotcha above), and adds the
    owner's `listing_submissions` select/insert and `listing_media` write policies the guided form
    needs. Its `do $$` block reproduces and re-proves the boundary on every migration application.
  - Domain layer `src/lib/real-estate/dashboard.ts` (pure: `isOwnerSettableTransition`,
    `OWNER_SETTABLE_TRANSITIONS`, `moderationState`, `summariseListings`, `accessibleDashboards`),
    `dashboard-loaders.ts` (session-scoped reads that return empty on failure), `dashboard-actions.ts`
    (create/update/status/submit/media/profile, all with the `authorize()` idiom), and
    `dashboard-page.ts` (the shared route guard).
  - Surfaces: `/account/landlord` and `/account/agent` (overview + verification gate),
    `/…/new`, and `/…/[id]` (form + status controls + gallery); the agent dashboard adds the public
    profile panel. All six routes are `force-dynamic` + `noindex`.
  - The account page links a dashboard only for an approved capability, through the same
    `accessibleDashboards()` predicate the routes guard with.
  - `dashboard.test.ts` (17) and `owner-listing-workflow.test.ts` (7) cover the model and the
    migration's shape.
- The two dashboards were consolidated into one dynamic route tree with a sidebar shell:
  `src/app/(site)/[locale]/account/[dashboard]/{layout,page,new,[id]}` serves both `landlord` and
  `agent` (the six static pages were deleted). `src/components/account/DashboardShell.tsx` is the
  shared chrome — a sticky `bg-ink-950` sidebar on desktop and an off-canvas drawer below `lg`,
  mirroring the admin console's stacking (`relative z-20` bar, `z-10` panel, `z-0` backdrop) so the
  backdrop cannot win the `z-index` tie and swallow nav taps. `src/lib/real-estate/dashboard-nav.ts`
  is the pure nav model (leaf module, icon keys, kind- and locale-qualified hrefs, an `exact` flag
  for the overview entry). The layout authenticates and 404s an unknown kind but does not decide
  capability, so a pending applicant still reaches the verification panel. `dashboard-nav.test.ts`
  (14) and `DashboardShell.test.tsx` (5) cover the model and the stacking rule.
- Sign-up now collects a phone number and a residency declaration.
  `20260101000066_signup_phone_and_residency.sql` drops the `not null default true` from
  `profiles.permanent_residency` (null is "not stated") and re-creates `handle_new_user` to read
  `phone` and `permanent_residency` from the sign-up metadata, with a `do $$` self-test for the
  round-trip and the escalation guard. The `SignUpForm` gained the phone field and the residency
  radio; `ProfileResidencyForm` stores a stated "no" as an explicit `false`.
- Geography is now a reference dataset rather than a typed string. Migration
  `20260101000071_geography_reference_data.sql` applies the 34 accented/hyphenated name
  corrections from the supplied Cameroon CSVs (rejecting the CSV code scheme, which would violate
  `regions_code_format` and break every stored reference), adds nullable `division_id` /
  `subdivision_id` to `electrical_projects`, `agent_profiles`, `inquiries` and `profiles` with
  composite foreign keys and depth checks, adds a trigger that clears the deeper levels when a
  region is cleared, and exposes `geography_reference_tree()` — the whole hierarchy in one
  read — to the browser. `supabase/validate/130_geography_reference_behaviour.sql` proves the
  rejections and the cascade; `geography-reference-migration.test.ts` (11) pins the shape without a
  database. See "Geography reference data" above for the decisions and the `MATCH SIMPLE` trap.
- 1336 Vitest tests pass (102 files), `tsc --noEmit` is clean, ESLint is clean, and the production
  build succeeds (137/137 static pages). The SQL is verified with `pglast` rather than a live
  database: no Postgres server and no Docker socket are reachable in this container, so
  `supabase/validate/*.sql` was not replayed.
- 1170 Vitest tests run (90 files) with `tsc --noEmit` and ESLint clean. The one failure is
  `src/lib/store/storage.test.ts` ("uses the Storage URL for an ordinary product"), which asserts a
  null URL when Storage is unconfigured; it fails only because the local `.env.local` points at the
  dockerised stack, and it fails identically at `HEAD` with that file present. It is environmental,
  not a regression.
- Phase 4 (Jiji-style marketplace redesign) is implemented:
  - Migration `20260101000063_listing_sort_relevance.sql` adds the `relevance` value to
    `listing_sort_order` in its own migration (Postgres refuses to use a new enum value in the
    transaction that adds it). Migration
    `20260101000064_publisher_verification_and_search_filters.sql` adds the publisher-verification
    columns/triggers and redefines `search_property_listings` with `p_currency`, `p_verified_only`
    and `p_amenities`, plus the new `listing_facets()` RPC.
  - Search layer `src/lib/real-estate/search.ts`: `ListingFilters` gained `currency`,
    `verifiedOnly` and `amenities`; `PROPERTY_CATEGORIES` drives both the landing shortcuts and the
    sidebar; `parseCurrency`/`parseVerifiedOnly`/`parseAmenities` are the URL boundary.
  - Surfaces: the redesigned marketplace landing (`MarketplaceSearch`: location + keyword +
    search + category shortcuts) and the two-column listings view (`ListingSidebar` with
    collapsible `FilterSection` groups, `ResultsToolbar`, `ActiveFilterChips`, `MobileFilterDrawer`,
    `VerifiedBadge`, compact `ListingCard`).
  - Super-admin verification console at `/admin/real-estate/verification`
    (`PublisherVerificationForm`, `verification-actions.ts`); the badge is written only by a super
    admin through the session client, so `enforce_membership_verification` is the control.
  - Multi-image upload for products (`media-actions.ts`), listings (`media-actions.ts`,
    `dashboard-actions.ts`), with a "use as card image" control for products.
  - 1102 Vitest tests pass (84 files), `tsc --noEmit` is clean, ESLint is clean, and the production
    build succeeds (145/145 static pages).
- Phase 7 (admin management and content lifecycle) is implemented:
  - Migrations `20260101000067_admin_content_lifecycle_and_deletion.sql` and
    `20260101000068_content_deletion.sql` add the `audit_logs.reason` column, a
    `forbid_unsanctioned_delete` trigger on `property_listings`, `products`,
    `electrical_projects` and `insights` (a `for all` policy's DELETE grant is not a removal path),
    `archive_listing` / `delete_listing_permanently` for listings, and
    `delete_content_permanently` for products/projects/insights. Both new RPCs are classified for
    the Phase 12 EXECUTE surface in the migration that creates them.
  - Multi-image upload for **projects** (`uploadProjectMediaAction`) and **insights**
    (`uploadInsightImageAction`) now reads every file from `formData.getAll("image")` and stores the
    batch, stopping at the first refused file and reporting `media_added_partial` /
    `image_added_partial` so a partly-valid batch keeps what landed. The project form restricts the
    input to one file unless the role is `general`, because the before/after slot is unique.
  - Edit mode for products: `ProductForm` takes an optional `initial` prop and posts to
    `updateProductAction` (validated by `productUpdateSchema`), rendered on
    `/admin/(console)/store/[id]`.
  - Deletion UI: `DeleteContentForm` (super-admin-only, two-step reason confirmation) on the
    product, project and article detail pages; `ListingLifecycleForm` (archive for any real-estate
    admin, permanent delete for a super admin) on the listing detail page.
  - The admin listings table gained a GET-form search/status filter (`loadAdminListings` takes
    `search`), so the applied filters live in the URL and the query is filtered in the database.
  - **The permanent-deletion RPCs are called with the cookie-bound session client, never the
    service-role client.** `delete_content_permanently` and `delete_listing_permanently` authorize
    inside the database with `is_super_admin()`, which reads `auth.uid()`; a service-role call
    carries no JWT subject, so the guard would refuse every deletion. `deleteProductAction` and
    `deleteInsightAction` originally used the admin client and so could never delete anything —
    a defect invisible to `tsc` and to every unit test, since both clients share one type.
    `admin-deletion.test.ts` now reads the source and asserts the RPC's client is the session one.
    Storage-object cleanup (cover, gallery, product media) still uses the service-role client,
    because the buckets have no browser write policy; `deleteProductAction` gained that cleanup so a
    deleted product no longer leaves orphaned photographs.
  - 1194 Vitest tests pass (92 files), `tsc --noEmit` is clean, ESLint is clean, and the production
    build succeeds. All 11 `supabase/validate/*.sql` scripts pass on a fresh PostgreSQL 17 database
    (69 migrations).
- The property price sort is currency-scoped. Migration
  `20260101000069_price_sort_currency_scope.sql` replaces `search_property_listings` (same
  signature, so the Phase 12 browser grant is untouched) so `price_asc`/`price_desc` group by the
  currency code before comparing prices, and no listing is ever ordered against one priced in a
  different unit. The migration's own `do $$` block asserts the grouping against
  `pg_get_functiondef` and is verified load-bearing; `marketplace.test.ts` pins the migration text
  as the cheaper complement.
- Demo accounts were removed. `scripts/seed-demo-users.sql` is deleted and migration
  `20260101000051_remove_demo_accounts.sql` deletes any rows it left behind (by the reserved
  `@demo.kctechc.test` domain), so a database that once ran the seed no longer holds nine
  known-password logins. No demo credential is committed anywhere.
- The shared header now carries a session-aware cart action (`CartAction` + `useCartSummary` +
  `GET /api/cart/summary`), so a customer can reach the cart after adding an item without leaving
  the page they are on.
- Electrical Services gained an "Our brands" strip naming SAKO POWER (solar components) and
  HIKVISION (CCTV components).
- The corporate and Digital Marketing hero backdrops were replaced with on-theme, licence-clean
  photography (see "Hero image provenance" below): `/hero/corporate-v3.jpg` and
  `/hero/digital-marketing-v3.jpg`. Both measurably raise heading and body contrast over their
  predecessors.
- The four corporate pages (`/about`, `/services`, `/gallery`, `/contact`) each carry their own
  backdrop now, declared in `CORPORATE_PAGE_HEROES` and read through `corporatePageHero(page)`. They
  previously shared `corporate-v3.jpg` (About and Contact) or borrowed a department hero (Gallery
  used Electrical Services), and Services had no image at all. Three are CC BY and render their
  credit in the hero; the About backdrop is CC0. All four clear WCAG AA at every breakpoint
  (worst 5.79:1 at 1024px) and the four pages report Lighthouse accessibility/SEO/best-practices
  100 in both locales.
- The Cameroon administrative hierarchy below Region is now seeded from a vetted dataset.
  `20260101000004_geography.sql` seeds only the ten Regions (the brief supplies only those) and
  leaves divisions/subdivisions to the `import_administrative_divisions` path, so on every
  deployment the real-estate filter's two lower selectors were permanently disabled — there was
  nothing to choose. Migration `20260101000055_cameroon_divisions_and_subdivisions.sql` applies the
  Open Admin Data dataset (CC BY 4.0) as schema data: **58 divisions and 360 subdivisions**, plus a
  restatement of the ten Regions because migrations run before `seed.sql` (a fresh database would
  otherwise join against nothing). The filter now shows every region, division and subdivision with
  its published-listing count (0 shown as no count) instead of only the branches that happen to
  have inventory today. `src/lib/real-estate/geography.ts` holds the pure
  `buildGeographyTree`/`GeographyCounts` arrangement (moved out of `loaders.ts`), and the French
  selector labels come from `name_fr` with an English fallback. `supabase/validate/90_*.sql` proves
  the seeded counts, the internal consistency and the anon visibility on a fresh database;
  `geography.test.ts` and `geography-migration.test.ts` cover the arrangement and the migration
  content without a database.
- Migration `20260101000054_correct_head_office_locality.sql` repairs the stored head-office
  locality. The footer renders `site_settings.site.contact`, falling back to the brief only when the
  row is absent or malformed, so a misspelt locality in the row (`Limbo`) was rendered verbatim and
  never corrected — the row is the fact, not the repository string. The migration rewrites only the
  `address` key via `jsonb_set` (preserving the editable `email`/`phones`), is guarded so it is a
  no-op on an already-correct database, and restates the table comment.
- The footer's second contact address was `info@kctectc.com` — a transposed domain that resolved
  nowhere, while the other two addresses use `kctechc.com`. Corrected to `info@kctechc.com`, and
  `src/lib/config/site.test.ts` now pins the whole contact block (name, phones, address, one shared
  domain, `email` first in `emails`) against the brief.
- `SITE_REVISION_DATE` was bumped to `2026-11-05` for the Digital Marketing hero-heading change
  (which is a visible change on a statically-listed page).
- Phase 9 (design, SEO and accessibility audit of the real-estate marketplace) is implemented. The
  audit found three defects, all fixed: the property card chose its fact icons by array position, so
  a listing with bathrooms but no bedroom count showed a bed icon beside "2 bathrooms"
  (`listingFactChips` now returns `{ kind, label }`); `formatArea` hard-coded `"en-CM"`, so French
  pages rendered "1,234 m²" instead of "1 234 m²" (it now takes the locale); and five comments
  described a filtered view as `noindex, follow` while `buildMetadata` has emitted `nofollow` since
  Phase 1. The rest of the brief was verified rather than changed — see the Phase 9 section above for
  what was checked and why each item was left alone. 1207 Vitest tests pass, `tsc --noEmit` is clean,
  ESLint is clean, the production build succeeds (137 static pages), and Lighthouse reports
  accessibility 100 / SEO 100 / best-practices 100 on every indexable real-estate surface.
- Phase 4 (real-estate marketplace redesign) is implemented and verified against the running
  production build: the department landing carries the hero search (location, keyword, submit,
  category shortcuts), the results page is the two-column `lg:grid-cols-[17rem_1fr]` shell (272px
  sidebar, a grid track so it cannot overflow) with collapsible filter sections, cascading geography,
  a currency-scoped price range, characteristics, a verified-publisher filter, the toolbar, active
  filter chips and a mobile drawer that reports the active count. Cards were redesigned to the
  marketplace shape (prominent photograph, price and period, title, location, category, facts,
  publisher badge, save control). Listing detail, gallery, favourites, saved searches, pagination,
  map view, localized slugs, breadcrumbs, metadata and JSON-LD all still work. The one defect found
  were two: the results grid had no LCP candidate, and `connect-src` omitted the map tile origin so
  `?view=map` could never render. Both are fixed and covered — see "CSP blocked the map entirely"
  and "The marketplace results grid had no LCP candidate" below. 1367 Vitest tests pass (104 files),
  `tsc --noEmit` is clean, ESLint is clean, the build succeeds, and Lighthouse is 100 on
  accessibility, best-practices and SEO for the listings page on desktop and mobile, with
  performance 89-93 under applied throttling.
- The store cart and product detail surface were polished, and two real defects were found by
  measuring the running build rather than by reading the code:
  - `CartLines` was rewritten as a marketplace line item (thumbnail, title link, unit price, a
    quantity stepper clamped to stock, a remove control) and the cart page became a two-column
    `lg:grid-cols-[minmax(0,1fr)_22rem]` shell with a sticky order summary and a real empty state.
  - **The summary column lacked `min-w-0`**, so its 315px min-content forced a 320px viewport into
    15px of horizontal page scroll while every desktop width measured 0. Fixed; the same class is
    now on both grid items.
  - **The quantity and remove controls were 28-36px**, below the 44px touch guideline. They are now
    `h-11 w-11`; `CartLines.test.tsx` (5) asserts the classes, and the assertion was proven by
    reverting the size and watching it fail.
  - `cartErrorMessage(code, t)` in `src/lib/store/cart-error-messages.ts` replaces the single
    generic "something went wrong" with a per-code message, so `unconfigured` no longer tells a
    visitor to retry an action that cannot succeed. `cart-error-messages.test.ts` (7) pins it.
  - `descriptionBlocks` in `src/lib/store/description.ts` renders a plain-text description as
    paragraphs plus bullet lists (the editors' "Includes: …" convention) without ever interpreting
    HTML; `description.test.ts` (9) covers it.
  - Multi-image upload was verified end to end against the running build: two photographs were
    uploaded to a real product through `/admin/store/<id>` and the image rows went 3 to 5. The
    test rows were then deleted. The input is already `multiple`.
  - 1481 Vitest tests pass (119 files), `tsc --noEmit` is clean, ESLint is clean, the build
    succeeds, and Lighthouse reports accessibility 100 / best-practices 100 / SEO 100 on the
    product page, the store index, `/en/real-estate/listings` and `/en`. The cart reports SEO 66
    from the single `is-crawlable` audit, which is its deliberate `noindex`.

### Hero image provenance

Every hero backdrop is a Wikimedia Commons file with a licence that permits commercial use
without royalty, chosen so each surface reads as its own subject rather than reusing one photo.

#### Department backdrops

The corporate hero reads as infrastructure/engineering and the Digital Marketing hero reads as the
department's own commercial subject.

- `/hero/corporate-v3.jpg` — "Fiber optic cable installation" (Rubin Observatory/NSF/AURA),
  **CC BY 4.0**, requires attribution. Source:
  `https://commons.wikimedia.org/wiki/File:Fiber_optic_cable_installation_(rubin-20170124-101126).jpg`.
- `/hero/digital-marketing-v3.jpg` — "Mini shopping cart placed on a table next to a laptop"
  (Shixart1985), **CC BY 2.0**, requires attribution. Source:
  `https://commons.wikimedia.org/wiki/File:Mini_shopping_cart_placed_on_a_table_next_to_a_laptop_in_a_modern_office_setting.jpg`.

Both files were cropped to 16:9 and resized (corporate 2048×1152, DM 2560×1440) before
commit. The attribution obligation for these two CC BY files is **not yet rendered in the UI**;
surface a credit (or swap to the CC0 alternatives below) before launch.

- `/hero/real-estate-v3.jpg` — "Modern residential facade" (Samuel Zeller, via Unsplash),
  **CC0**, no attribution obligation. Source:
  `https://commons.wikimedia.org/wiki/File:Modern_residential_facade_(Unsplash).jpg`.
  Cropped 16:9 and resized to 2048x1152, then brightness-matched to the asset it replaced so
  the hero scrim's measured contrast carries over. It supersedes `real-estate-v2.jpg`, which was
  **626x417** — the only department hero under 1024px, and the LCP element of the real-estate
  page. `next/image` never upscales, so the `w=2048` request returned the 626px source and every
  visitor saw it stretched. The hero test now holds full-bleed department heroes to 1600px
  (corporate page heroes, which sit behind a narrower band and top out at 1024, keep a 1000px
  floor) so this cannot recur.

CC0 fallbacks already vetted for contrast, should attribution be undesirable:

- Corporate: "Data center infrastructure in the United States" (DOE/NREL, public domain).
- Digital Marketing: "Analytics graphs on a MacBook screen" (Luis Llerena, CC0).

#### Corporate page backdrops (About / Services / Gallery / Contact)

The four corporate pages each own a distinct backdrop, declared in `CORPORATE_PAGE_HEROES`
(`src/lib/config/site.ts`). About is a CC0 Commons photograph and carries no credit. Services,
Gallery and Contact use the **business-supplied brand artwork** the client provided (an Imgur
album); no attribution obligation is known for them, so they carry no credit either. All four are
stored as landscape JPEGs under `public/hero/`.

- `/hero/about-v2.jpg` — "Vue aérienne de la ville de Bafoussam" (PENdjeng), **CC0**, no
  attribution required. Source:
  `https://commons.wikimedia.org/wiki/File:6._Vue_a%C3%A9rienne_de_la_ville_de_Bafoussam.jpg`.
  (An earlier pick, a CC0 Mount Cameroon photograph, was replaced after it measured 2.66:1 at
  1024px — see the gotchas below.)
- `/hero/services-v2.jpg` — the client's technical/scale-drawing artwork (white ground, geometric
  line work), supplied via `https://imgur.com/a/1BQSLkA`. No attribution obligation known.
- `/hero/gallery-v2.jpg` — the client's "Success / Strategy / Planing / Idea" graphic, supplied via
  the same album. No attribution obligation known.
- `/hero/contact-v2.jpg` — the client's "CONTACT US" artwork, supplied via the same album. No
  attribution obligation known.

**Provenance is unverified for the three client-supplied files.** They arrived as an Imgur album
with no licence statement and no per-image title, so their copyright status could not be confirmed
from the source. The client asserts they are the company's own artwork; if that is wrong, replace
them before launch. The Imgur originals top out at **1024px** wide, so these are the smallest
corporate backdrops and `next/image` cannot serve a wider variant than the source (the floor in
`hero-images.test.ts` is 600 for exactly this reason).

The older `corporate-v3.jpg` and `digital-marketing-v3.jpg` above still render no credit and remain
the outstanding attribution debt. The superseded `services-v1.jpg`, `gallery-v1.jpg` and
`contact-v1.jpg` (all CC BY Commons files) were removed once nothing referenced them.

### Hero image gotchas worth not rediscovering

- **A bright photo destroys the hero's small-text contrast even when the heading still passes.**
  The department heroes put an 11px eyebrow on the department accent (`--dept-accent-bright`,
  DM `#6FA8F5`) and the body copy on a light ink tone. Over a bright image those measured
  4.34:1 and 5.20:1; the current dark DM backdrop measures 7.97:1 and 8.05:1. The heading uses
  the light `electric-300` and passes on almost anything, so a heading-only check is misleading.
  Measure the eyebrow and the body paragraph, at the real accent colour, not just the `h1`.
- **Measure the background, not the glyphs.** Sampling the pixels inside a text element's rect
  catches anti-aliased glyph edges, which report a contrast near 1.0 for every image and hide
  the real differences. Take a second screenshot with the copy elements set to
  `visibility: hidden` (each text element, not the hero — `visibility` on the hero also hides
  the photo) and sample the background pixels inside those same rects.
- **`visibility: hidden` on a parent does not hide a child that sets `visibility: visible`.**
  Hiding `section.on-ink` to reveal the photo underneath does not work when descendants set
  their own visibility; hide the individual text elements instead.
- **`cp -r public .next/standalone/public` nests a directory when the target already exists**,
  leaving `public/public/...` while the server keeps serving the stale file. The symptom is a
  measurement that does not move after an asset swap, which looks like image-optimizer caching.
  Copy the specific changed files, or `rm -rf` the target first, and verify with `md5sum`
  against the source.
- **The dev-preview `next-server` process is named `next-server`, not `server.js`,** so
  `pkill -f server.js` / `ps | grep server.js` misses it and the stale server keeps the port.
  Match on `next-server` when restarting a preview build.
- **A photo swap changes no SEO output.** `HeroMedia` renders `alt=""` inside `aria-hidden`, and
  Open Graph/Twitter images come from the `imageUrl` argument to `buildMetadata`, never from
  `heroImage`. Nothing in the SEO layer reads these files, so no metadata update is required.

### Department micro-themes (whole-site palette per department)

- Each department repaints the **whole shared palette** — canvas, body/muted copy, the ink
  ramp, borders and the accent — not just the accent. The values live in
  `DEPARTMENT_THEME_TOKENS` (`src/lib/config/site.ts`); `globals.css` maps
  `html[data-theme="<slug>"]` onto them and `theme-contrast.test.ts` asserts both the WCAG AA
  ratios and that the stylesheet still carries the same values.
- **There are two light tokens, and the split is what makes a theme visible: `--color-canvas`
  is the page/section-band background and `--color-surface` is the card/panel that sits on it.**
  `body` and `SectionBand`'s default tone read `canvas`; cards, panels and form controls keep
  `surface`. A department canvas is a clear tint of the department hue (DM `#EEF1FB` indigo,
  ES `#FFF3E7` cream, RE `#E5EFE8` sage) while its cards stay near-white, so the page reads as
  tinted rather than as a flat white sheet. `surface-alt`/`surface-sunken` are a second and third
  step of the same tint for alternating bands. The corporate theme sets `canvas` = `surface` =
  white, so it is unchanged. `theme-contrast.test.ts` asserts the card is lighter than the canvas
  for every department, which is what stops the two converging back into one value.
- The active theme is resolved from the **path**, never from a prop or stored preference:
  `themeSlugFromPathname` (`src/lib/theme/department-theme.ts`) is shared by the pre-paint
  bootstrap script in the root layout, by `ThemeController` (client navigations) and by the
  department pages' `generateViewport` (`theme-color`). The attribute is set on `<html>` because
  the shared header and footer sit outside the page subtree. The bootstrap renders as the first
  element of `<body>` (not a hand-written `<head>`), which still executes before the rest of the
  document is parsed, so a deep link paints the department palette without a corporate flash.
- Accents were moved to accessible values: DM `#0066CC`, ES `#C2410C` (bright `#F0A94A`), RE
  `#1E5631`; the requested DM `#0066CC` / RE `#1E5631` clear AA on their canvases, the requested
  ES `#D35400` did not (3.72:1) so it is darkened to `#C2410C`.
- Shared chrome that reads brand rather than department colour now follows the theme through
  document-level `.text-accent` / `.text-accent-bright` utilities: the footer column headings and
  the active language link.

### Department micro-theme gotchas worth not rediscovering

- **An unlayered rule beats every layered one, so a global theme transition must live in
  `@layer base`.** A top-level `:where(html[data-theme]) * { transition: … }` (or any top-level
  `html` selector) silently overrides Tailwind's layered `.transition-soft` and `[data-reveal]`,
  stripping the hover lifts and scroll reveals of the transition they depend on. `globals.test.ts`
  already forbids a top-level `html` selector for this reason, which is why both the token blocks
  and the transition sit inside `@layer base`; the selector is `:where(…:where())` so its
  specificity stays zero and utilities still win.
- **`@theme` is for Tailwind's `theme` layer; a `[data-theme]` token block belongs in `base`.** The
  generated `--color-*` names only resolve because Tailwind v4 emits the plain `:root,:host` block
  without `@property { inherits: false }` (that is only emitted for `--tw-*`), so a subtree
  override cascades. Do not add these tokens to `@theme`, which would sit _below_ `base` and lose.
- **`data-theme` is applied to `<html>`, not to `departmentScopeProps`.** That helper is shared
  with individual department _cards_, so adding `data-theme` there puts a misleading attribute on a
  card on a corporate page. The path is the single source of truth for the document theme.
- **`generateViewport` and `generateMetadata` can coexist on one route, and both may be async.**
  Adding `generateViewport` for the department `theme-color` did not change the prerender status
  of any route.
- **A light-on-dark accent needs its own bright variant, and the bright variant is what the footer
  headings and active language link use.** `#0066CC` on the DM ink band is 3.01:1, so the dark-band
  accent is `#6FA8F5`; the test asserts `accentBright` against `ink950`, not `accent`.
- **The theme bootstrap belongs in `<body>`, not a hand-written `<head>`, so Next keeps sole
  ownership of the document head.** A manual `<head>` in the root layout is a documented
  anti-pattern; the script still runs before the body content is parsed, so the no-flash guarantee
  holds. `department-theme.test.ts` now pins both the position and the absence of `<head>`.
- **A stale `<title>` after client-side navigation is pre-existing on this Next 16 build, not a
  theme regression.** Clicking Home → About via the App Router updates the URL and body but the tab
  title stays `KC Technology Corporation`; a hard load of the same URL shows
  `About the company | KC Technology Corporation`, and the prerendered HTML has the correct title.
  It was reproduced on `939c672` (before any theme work) with the theme bootstrap and
  `ThemeController` removed, so do not chase it in a theme PR — and do not trust a headless tool's
  tab title alone for it; compare a hard load against a client navigation.
- **The hero accent glow is deliberately on the far edge from the copy.** `.dept-glow` started as a
  bloom at the copy corner and dropped the DM hero heading to 4.65:1 — measured from a screenshot,
  because the composite of photo + scrim + glow is not something the token test can see. It now
  sits at `88% 2%`, over the photograph rather than the text, which both restores the heading
  margin and reads as a rim light. Any new decorative layer that lands under hero copy needs the
  same screenshot-based re-measurement, not just a token check.
- **Section spacing is a lever for "the site looks scanty", and it is safe to pull.** `.section`
  was 4.5/7rem and is now 3.5/5rem (`.section-tight` 2/2.75rem). At the old values consecutive
  bands sat far enough apart that a page read as a column of headings with empty page between
  them; the band tints now carry the separation instead. No test asserts the numbers, so this is a
  judgement call — measure the rendered page, do not assume tighter is worse.
- **`SITE_REVISION_DATE` is the sitemap `lastmod` for statically-listed pages and must be bumped
  when a visible change ships.** It is deliberately not `new Date()`; a `lastmod` that changes
  every request is ignored by crawlers.

### Founder's message gotchas worth not rediscovering

- **A department-scoped accent is a silent fallback, so a subtree that renders its own
  `card-edge` must set `data-department`.** `SiteIndex`'s department cards read `--dept-accent` for
  their rail and link hover. Without `departmentScopeProps(department.slug)` every card renders
  corporate teal and nothing errors — the same trap the design system section warns about.
  `SiteIndex.test.tsx` asserts the attribute per card.
- **The gateway's numbered eyebrows are an ordered sequence; inserting a section renumbers the
  rest.** The founder's message and the site index were inserted after `02 —` and the `Entry`
  section had to move from `03` to `05`. Leaving it would have printed two `03`s on one page.
- **The `projects` ("Work Done") surface shares `departmentHasServices`.** Real Estate has no
  services, so it has no `/projects` route either; the index therefore links projects under the
  same predicate rather than assuming every department has one.
- **The portrait is a generated placeholder, not a photograph of the founder.** The brief forbids
  fabricating staff; the letter and attribution are user-supplied, but the image at
  `public/brand/chairman-portrait.jpg` is a gradient composition. Replace it with a real portrait
  before launch (and keep a new filename so the CDN's `max-age` does not serve the old bytes).
- **A department index label should use the destination's own heading key.** Linking the
  department portfolio as `nav.gallery` ("Gallery") while the page heading is `portfolio.heading`
  ("Our work") gives two names for one destination; use the page's heading key.

### Known defect: `<html lang>` is always `en` (pre-existing, unfixed)

- **`src/app/layout.tsx` hardcodes `lang="en"`, so every `/fr` route serves `<html lang="en">`.**
  The locale segment (`[locale]`) is nested under the `(site)` group _below_ the root layout, so the
  root layout cannot see it and Next 16's `next/root-params` is unavailable (root params must be
  segments before the root layout). Verified against the running build: `/fr` and `/fr/about` both
  return `<html lang="en">`, and the FR `<title>` falls back to the untranslated default
  (`KC Technology Corporation`) because the locale layout's `generateMetadata` has no `title`.
  This violates the SEO rule "correct `html[lang]`" and is a screen-reader pronunciation problem.
  It predates the founder's-message work (introduced in the Phase 1 layout). The fix is a route
  restructure — move the locale segment to `src/app/[locale]/layout.tsx` so it _is_ the root layout
  (or add a `next/root-params` accessor) and set `lang` from the resolved locale — but that touches
  every route group and the admin tree, so it belongs in its own change with its own verification,
  not a feature PR. Do not paper over it with a client-side `document.documentElement.lang` patch:
  that is invisible to crawlers and the pre-hydration paint.

### Phase 6 — reusable multi-department filtering

- **The search experience is one shared shell, not one per department.** `MarketplaceSearchLayout`
  (two-column grid: `17rem`/`18rem` filter track + results), `MarketplaceFilterSidebar`,
  `MarketplaceFilterSection`, `MarketplaceActiveFilters`, `MarketplaceMobileFilterDrawer`,
  `MarketplacePagination`, `MarketplaceResultsToolbar`, `MarketplaceCategoryNavigation`,
  `MarketplaceSearchHeader`, `MarketplaceEmptyState` and `MarketplaceSearchableSelect` live in
  `src/components/marketplace/`. Real Estate, the Store index/category pages and the projects
  gallery each pass their **own fields** through the layout's `filters(variant)` render prop — the
  shell arranges, the department supplies controls — so the desktop column and the mobile drawer
  render the _same_ form and cannot drift. Do not build a fourth bespoke results layout: add a
  binding component (`src/components/{store,content}/*Filters.tsx`) like `StoreActiveFilters` and
  `ProjectActiveFilters` do.
- **A filter is a URL, and the URL is the state.** Every department parses its filters from
  `searchParams` (`parseListingFilters`, `parseStoreFilters`, `parseProjectFilters`), serializes the
  whole state back (`buildStoreQuery`, `serializeProjectFilters`), and removes one filter by
  rebuilding from the parsed object (`removeStoreFilter`). Never hold filter state in React and
  never filter a loaded array in the browser — filtering, counting and pagination run in the
  database (`search_property_listings`, `search_products`), which is what the brief rules out doing
  any other way.
- **A filtered view is `noindex`, and _every_ filterable surface must apply the rule from its
  parsed state.** Real Estate (`hasActiveFilters`) and the projects gallery (`isUnfiltered`) did;
  the Store index and category pages did **not**, so `/en/digital-marketing/store?q=…&minPrice=…`
  served `index, follow` — a near-duplicate of the bare store for every permutation. Both now pass
  `noindex: hasActiveStoreFilters(filters)`. A category page pins its own segment
  (`{ ...parseStoreFilters(await searchParams), category: undefined }`) before evaluating the rule,
  so the segment alone never makes the view filtered. `localized-category-routing.test.ts` asserts
  the directive on both store routes; the regression was proven by deleting the line and watching
  it fail.
- **`product_facets`/`search_products` are browser-callable RPCs and were added to the Phase 12
  EXECUTE allow-list in the same change that created them** (`20260101000065_product_search_and_facets.sql`
  plus the allow-lists in `20260101000041_function_execute_hardening.sql` and
  `supabase/validate/30_function_execute_hardening.sql`). Supabase grants `EXECUTE` to
  `anon`/`authenticated` on every new function by default, so a search RPC that is _not_
  classified fails the subset assertion in the validate script.
- **A category's facet count is keyed by canonical slug while the nav links by localized slug.**
  `product_facets` returns canonical category ids → slugs; the sidebar resolves a `{value,label}`
  through `loadCategoryRecord`/`resolveBySlug` and reads `facets.categories.get(record.slug)`, not
  `category.slug`. Mixing them works in English (where the slugs match) and shows a zero count the
  moment a French slug exists. `localized-category-routing.test.ts` pins both the count lookup and
  the link build.
- **A bilingual regression test cannot see a feature whose data source is empty.** The store
  catalogue is empty without a configured Supabase, so the sidebar/nav/drawer render their honest
  empty state and the _only_ way to prove the filter controls is against the seeded database or by
  reading the built HTML for the shared chrome. `MarketplaceComponents.test.tsx` (server markup),
  `marketplace-i18n.test.ts` (EN/FR key parity) and the per-department bindings are what keep the
  shell honest without a database.
- **The mobile drawer is the same `Modal` the navigation drawer uses** (`placement="side"`), so
  focus trapping, Escape, scroll lock and focus return are already handled — do not hand-roll a
  second sheet. It is `lg:hidden`, the desktop column is `hidden lg:block`, and the two share the
  filter form via the render prop. Verified in a real browser at 320/360/390px: `scrollWidth ===
clientWidth` on every department (no horizontal scroll), the trigger reads "Filters"/"Filtres"
  with the active count, and opening it mounts one visible `role="dialog"` containing the form.

### Phase 13 gotchas worth not rediscovering

- **The console page guard is a message, the write policy is the control.** `requireEditor` and
  `departmentsForRole` run in the Server Action so the editor sees "not your department" instead of
  a raw policy violation, but a department editor's real boundary is the RLS policy from
  `20260101000042_department_project_editing.sql`. The row writes deliberately use the cookie-bound
  client (never the service-role client) so that policy is what refuses a cross-department write.
- **`getAdminProject` must be scoped, not just the list.** The public select policy makes another
  department's _published_ project world-readable, so a guessed id would otherwise open an edit
  form whose save the write policy then refuses. Scoping the detail read to
  `departmentsForRole(role)` turns that into a 404, so the page and the database agree.
- **A comment that promises a constraint is not the constraint.** The department-scoped write policy
  on `electrical_project_services` initially checked only that the _project_ was in an editable
  department, while the migration comment said services were scoped too. Nothing in the schema ties
  `service_id`'s department to the project's, so a crafted POST could link an Electrical Services
  service to a Digital Marketing project; the console's picker was only a UI filter. The policy now
  joins `services` and requires `s.department_id = p.department_id`, and
  `40_department_work_behaviour.sql` proves both the accepted and the refused link. When a comment
  claims a boundary, implement it in the policy or delete the claim.
- **An allow-list entry is a claim about the _caller_, so verify it against the code, not the
  function's name.** `place_order` sat on the Phase 12 browser allow-list as "guest checkout" on the
  assumption the storefront called it through the publishable key. It does not: the only caller is
  `submitCheckout`, which uses the service-role client, so the grant only widened the surface of a
  `SECURITY DEFINER` write that authorizes a cart by id alone and takes a caller-supplied
  `p_customer_id`. Before granting a function to `anon`/`authenticated`, grep for its `rpc(` call
  sites and check which client each one holds (`createAdminClient` vs the cookie-bound or public
  client), and ask whether the function's _internal_ authorization is real.
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
- **A file's _encoding_ is part of the diff, and a byte-level fix can corrupt unrelated characters.**
  An em-dash written through the editor landed as a lone `0x97` byte, and a naive
  `replace(b"\x97", ...)` then also hit the `0x97` inside `●` (U+25CF = `E2 97 8F`), corrupting
  every bullet in the file. Repair by rewriting the _whole_ mis-encoded sequence
  (`\xe2\x80\x94`) rather than a single byte, verify with `python3 -c "...decode('utf-8')"`, and
  prefer plain ASCII in new doc prose.

### Phase 12 gotchas worth not rediscovering

- **Supabase grants function `EXECUTE` to `anon` and `authenticated` _by name_, not through
  `PUBLIC`.** `REVOKE ALL ON FUNCTION ... FROM PUBLIC` removes only the `=X` ACL entry; the
  `anon=X` and `authenticated=X` entries survive, so every function stays callable from a browser
  key. Supabase's own guidance is to revoke from _both_ `public` and the role. The first revision
  of migration 41 revoked from `PUBLIC` alone and so secured nothing — and its assertion only
  checked the named privileged functions, which still held their per-role grants, so it passed.
  The migration now revokes from `anon, authenticated` explicitly, and the assertion is a _subset_
  check (nothing reachable is outside the allow-list) rather than a deny-list. Reproduce the
  difference against a clean database before trusting a grant migration; the ACL is
  `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}` after a plain
  `REVOKE ... FROM PUBLIC`.
- **Postgres checks `EXECUTE` for RLS policy functions, CHECK constraints, column defaults and
  stored generated columns — but _not_ for trigger functions.** A blanket revoke therefore breaks
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
  call never runs. The application calls it with the _session_ client (so `auth.uid()` attributes
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

### Marketplace redesign (Phase 4) gotchas worth not rediscovering

- **A filter the sidebar does not carry in its form is a filter a submit throws away.** The
  sidebar is a plain GET form, so a filter survives only if the form submits it. `type`
  (`listingType`: sale/rent/short_term) is chosen from the category shortcuts on the landing page
  and had no control inside the form, so opening the mobile drawer on `/listings?type=rent` and
  pressing Apply silently widened a 4-result rent search back to all 12 listings. `region`,
  `division`, `subdivision`, `currency`, `verified` and `sort` all had hidden inputs; `type` did
  not. It does now, and `ListingSidebar.test.tsx` asserts every active filter is present in the
  submitted `FormData`. When adding a filter to `ListingFilters`, add its hidden input in the same
  change or it only works until the visitor touches another control.
- **`status` is deliberately URL-only.** It has no public UI control (only the admin KYC queue uses
  a `?status=` of its own), so it is the one serialized param the sidebar does not submit. That is
  not the same defect as `type` — do not add a control for it without a reason to expose listing
  state to visitors.
- **`page` must never be submitted.** A filter change has to restart at page one; carrying the page
  number would land a narrowed result set on a page that no longer exists. `buildListingQuery`
  writes `page` only when set, and the sidebar omits it.
- **MapLibre really is lazy, and the audit's suspicion was wrong.** `PropertyMap` is a static
  import in the listings page but the library itself is `await import("maplibre-gl")` inside the
  effect, so the list view downloads no map code. Confirmed from Lighthouse's network records: no
  request URL contains `maplibre` on `/listings`. Verify with the request list, not by reading the
  import graph — a static import of a module whose heavy dependency is dynamically imported is
  fine.
- **The listings page's performance score is hydration cost, not a defect to chase.** Measured with
  `--throttling-method=devtools` on the standalone build: FCP/LCP 1.8s, CLS 0, TBT 380ms, SEO/a11y/
  best-practices 100. The remaining gap to 100 is framework script evaluation shared with the store
  page (which scores 95), on a 1056-node DOM with 306 CSS rules and no duplicated sidebar. Images
  are already right: 2 eager above the fold, 10 `loading="lazy"`. Do not "fix" this by cutting real
  content.
- **A filtered URL is `noindex` on purpose, so a Lighthouse run on it reports SEO 69.** That is the
  duplicate-content rule working (canonical points at the unfiltered base), not a regression.
  Measure SEO on `/listings`, not on `?type=rent`.
- **The two-column layout is `lg:grid-cols-[17rem_1fr]` / `xl:[18rem_1fr]`** — 272px and 288px,
  inside the brief's 250-300px band. Measured at 320/375/768/1024/1280/1440: no horizontal
  overflow at any width, the `<aside>` is `display:none` below `lg` and the Filter button appears
  instead. The drawer is 320px wide with `aria-modal`, Apply and Clear, and a live active-filter
  count on the trigger.
- **`ListingGallery.test.tsx`'s fixture used `caption: null` while `ListingImage.caption` is
  `string | undefined`.** The real mapper (`records.ts`, via `asString`) yields `undefined`, so the
  fixture was both a type error and a misrepresentation of what the loader produces. A test fixture
  that does not match its mapper hides the difference between "absent" and "explicitly null".

### Phase 7 gotchas worth not rediscovering

- **A `"use server"` module may only export async functions.** The directive turns every export
  into a callable endpoint, so a plain helper or a constant beside the actions passes `tsc` and
  every unit test and then fails the production build with "Server Actions must be async
  functions". Shared logic belongs in a module _without_ the directive. `normalizeSearchQuery`
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

- **A gallery that renders thumbnails without a state swap is a dead control, and nothing in the
  build catches it.** `ProductGallery` shipped every uploaded thumbnail and never changed the main
  image, so a product's second and later photographs were unreachable — the multi-image upload was
  accepted and had no visible effect. The listing gallery had always done this correctly
  (`useState` + `aria-current`), so the defect was an inconsistency between two surfaces that look
  alike. It now lives in its own `"use client"` module (`src/components/store/ProductGallery.tsx`)
  and `ProductImageFrame.tsx` stays a Server Component, because the card and other surfaces import
  the frame directly and must not drag a client boundary in. `ProductGallery.test.tsx` fails if the
  click handler is neutered, which is the property that was missing.
- **An uncovered dynamic param plus `await searchParams` is a 500 in the production build only.**
  `/[locale]/[department]/store/[category]` enumerates only `department` in `generateStaticParams`
  (the category set is data) *and* awaits `searchParams` for its filter state, which throws
  `DYNAMIC_SERVER_USAGE` at request time. Dev served it fine and the build printed it as `●` with no
  warning, so the failure only appeared as a 500 from the standalone server — surfaced by Lighthouse
  as `errors-in-console` on the *product* page, because that page prefetches its category. The slug
  route beside it is unaffected: it reads no `searchParams`. The index is unaffected because it is
  fully covered by `generateStaticParams` and so inferred dynamic. Declaring
  `export const dynamic = "force-dynamic"` fixes it. Check every route that reads `searchParams`
  against whether its params are fully enumerated; the build marker is not evidence either way.
- **Lighthouse's `errors-in-console` can point at a page you did not ask it to measure.** The
  best-practices failure was a prefetch of the category route, not the product page under test. Read
  the audit's `sourceLocation.url` before assuming the measured page is at fault.
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
  which may only reach leaf modules by _relative_ path (`../i18n/locales` is a pure data module with
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
  where the breadcrumb lands near the start of the gradient. Tune on 1440 _and_ 1024.
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
  stretched full-bleed. `corporate-v3` is now 2048px and `real-estate` (626px) is still capped and
  needs a genuinely larger source image — confirm a source exceeds `1920px` before wiring it in.
  Replacing a hero file in place also leaves the URL unchanged, and Next serves optimised images
  with `max-age=14400`, so the old bytes linger for hours; ship a new filename instead.
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
  the resting state is the _visible_ one: the component adds `data-reveal="pending"` in a `useEffect`,
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
  is consumed _before_ the lookahead: test `/_next/static` as `_next/static`. Passing a
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

### Solar packages, multi-email contacts and the provider-less payment flow

- **The site takes no payment and no longer integrates a provider.** Fapshi was removed
  (`src/lib/payments/*`, `/api/payments/return`, `/api/payments/webhook`, `RetryPaymentButton`
  deleted; `FAPSHI_*` env and the health `payments` flag gone). A checkout records the customer's
  chosen **method as an intent** (`mobile_money_mtn`, `mobile_money_orange`, `bank_transfer`,
  `cash_on_confirmation`) and then mails the order to the business; the team contacts the customer
  to finalise payment. `card` stays in the stored enum for legacy rows but is never offered.
- **The admin notification is the signal that replaced the webhook.** `sendOrderNotificationToAdmin`
  goes to `orderNotificationRecipients()` — `ORDERS_NOTIFY_TO` when set, else every `SITE.emails`
  address — with the customer as `replyTo`. A failed send is logged and does **not** undo the order.
- **Nine SAKO solar packages are real store products**, not a separate catalogue:
  `src/lib/content/solar-packages.ts` (bundled brochure data, message-key copy) +
  migration `20260101000045_electrical_solar_packages.sql` (products, categories, media,
  `content_translations`, slugs). Surfaces: `/[locale]/[department]/packages` (grid + comparison
  table) and `/[locale]/[department]/packages/[package]`. `generateStaticParams` emits 9 × 2 = 18
  pages, so the build summary shows `[+15 more paths]` after the first three — that is expected.
- **`src/lib/store/product-path.ts` is the single cart/order link resolver.** A `KC-SOLAR-*` line
  links to its package page; every other line links to the store. `CartLines.tsx` and the order
  confirmation page both use it, so a package in a cart never links to `store/<package-slug>` (a
  404 — packages are not store slugs).
- **Add-to-cart resolves the package to a seeded product id server-side** in
  `PackageCartControls`; with no product row (an unseeded deployment) only request-info is offered,
  rather than a cart button that would fail.
- **`?package=` on `/contact` is resolved from bundled data** and pre-fills subject + message via
  `solarPackages.labels.requestSubject/requestBody`; an unknown id is ignored, never echoed.
- **`SITE.emails` is `[kctechc@gmail.com, info@kctechc.com, support@kctechc.com]`, and `SITE.email`
  is kept equal to the first entry** (the notification fallback and the "primary inbox" contract in
  `site-content.ts`). The contact page and footer render all three. Every address shares the
  `kctechc.com` domain; `info@kctectc.com` shipped in the original multi-email commit as a
  transposed domain and rendered verbatim in the footer, which is why `site.test.ts` now pins the
  whole contact block against the brief.
- **The FR header nav budget still holds with nine entries.** Measured on the running build: FR nav
  is **713px** wide at 1280 (`xl` breakpoint) inside a 1248px row, one line, no overflow —
  comfortably inside the 1168px content budget described in the Phase 2 gotchas. A CSS-500 from the
  standalone bundle makes the nav stack and look like it "does not fit"; check the stylesheet loads
  (`/_next/static/chunks/*.css` → 200) before concluding the budget is exceeded.
- **The local Postgres harness is unavailable in this container** (no server on `:5432`, no Docker
  socket), so the three new migrations are verified by inspection and by the `*.test.ts` suites, not
  by replaying `supabase/validate/*.sql`. None of the three creates a function, so the Phase 12
  EXECUTE allow-list is unaffected.

### Electrical product showcase (homepage strip + department grid)

- The six SAKO product families the Electrical Services department supplies are a plain data
  module (`src/lib/content/electrical-products.ts`), rendered by `ProductShowcase`. Each entry
  holds **message keys**, not strings, so the copy is localized through the same static dictionary
  as the rest of the UI and en/fr stay in step. Names and ratings are the ones printed on the
  manufacturer material; no spec, price, availability or warranty is claimed that the source did
  not state.
- **The same data gets two different animations, on purpose.** The homepage (`/` and `/{locale}`)
  uses the `marquee` variant — a continuous leftward drift that pauses on hover and keyboard focus.
  The Electrical Services landing page uses the `grid` variant — a staggered scroll-triggered rise
  with a slow accent pulse on the image frame. Sharing the data but not the motion is what keeps the
  two surfaces feeling related without repeating one effect.
- **Everything is server-rendered and the motion is pure CSS.** The products, names, ratings and
  image descriptions are in the HTML before any script runs, so a crawler and a no-JavaScript
  visitor get the complete content. The marquee's second set is `aria-hidden` with empty `alt`s, so
  the drift costs the accessible reading order nothing and crawlers see the six products once.
  `ProductShowcase.test.tsx` pins the server markup and the decorative duplicate.
- **The marquee is a genuine `<ul>` in normal flow, not a canvas or a JS carousel.** A
  `product-drift` keyframe translates the track by exactly `-50%` (one full set) and repeats, so the
  loop is seamless without measuring anything at runtime.
- **The reduced-motion block replaces the drift with a plain horizontal scroll** (`.product-marquee`
  is `overflow-x: auto`) rather than freezing the strip mid-travel, and removes the accent pulse
  entirely instead of collapsing it to a 0.01ms loop. `globals.test.ts` pins both fallbacks.
- **The accent pulse is scoped to `.product-grid .product-tile-media::after`.** The homepage
  marquee renders twelve tiles; an unscoped pulse would run twelve infinite animations at once. It
  is a `box-shadow` ring, never a colour change, so it cannot touch a product's own contrast.
- **A grid item's stagger delay depends on the column count, which is breakpoint-dependent.**
  Rather than read `matchMedia` in an effect (which `react-hooks/set-state-in-effect` correctly
  rejects), `ScrollReveal` writes all three delays as custom properties and the `.reveal-stagger`
  stylesheet rule picks one per breakpoint. The component never measures the DOM, so the server and
  client renders agree and there is nothing to flicker.
- **`staggerDelayVars` deliberately writes no inline `--reveal-delay`.** An inline custom property
  beats a stylesheet rule, so writing one would defeat the breakpoint override; only the
  non-stagger path sets `--reveal-delay` directly.
- **The showcase is gated to the electrical department, not to "departments with services".**
  `definition.slug === "electrical-services"` decides whether the grid renders. Digital Marketing
  has services but supplies no power equipment, so it must not show the grid — verified against the
  built HTML, where `/en/digital-marketing` carries none of the product images.
- **Numbered eyebrows are an ordered sequence, so inserting a section renumbers the rest.** Adding
  the showcase after the gateway departments pushed About from `02` to `03`, the founder's message
  to `04`, the site index to `05` and Entry to `06`; on the localized home and the department page
  the same shift applied. Leaving it would have printed two `02`s on one page.
- **Product images are asserted like the hero assets.** `electrical-products.test.ts` resolves every
  path on disk, checks the JPEG start/end markers, and requires a square, card-sized image (the tile
  media box is 1:1, so a non-square source is cropped and the subject can fall outside the crop). A
  mistyped path otherwise fails silently as an empty box.

### A migration must not assert a whole-table row count

- **`raise exception 'expected 10 regions, found 0'` was a real bug, not a bad message.** Migrations
  71 and 72 each opened their assertion block with `select count(*) from public.regions` and aborted
  unless it was exactly 10 (then 58, then 360). But Supabase applies migrations **before**
  `seed.sql`, and on a fresh database the hierarchy is seeded by migration 55 — so if 72 runs
  against a database where 55 has not been applied, or where regions were emptied, the count is
  legitimately 0 and the migration aborts. It also fails in the other direction: a database holding
  an operator's own extra region row gives 11, which is not an error either. The assertion was
  claiming ownership of rows the file does not own.
- **The fix is to assert the invariant, not the total.** The property that matters is "no row this
  file targets was left without a headquarters", expressed as
  `count(*) ... where code in (...) and headquarters is null` = 0. That is true on an empty table, on
  a fully seeded one, and on one with extra rows. Spot-checks are guarded the same way — `if exists
  (select 1 ... where code='SW') and not exists (... headquarters='Buea')` — because a bare
  `not exists` raises on an empty table too.
- **An empty hierarchy is not an error, but it must not be silent.** When nothing was targeted, the
  UPDATEs match zero rows and the columns stay null while the migration is recorded as applied —
  so a later run of 55 would never be followed by a re-run of 72. Migration 72 now `raise warning`s
  in that case with the instruction to apply 55 first and re-run. `update ... where code = ...`
  succeeding while touching zero rows is the general hazard; see the headquarters gotcha above.
- **Reproduced and verified against a real PostgreSQL 18 server** (`embedded-postgres`, since this
  container has no Postgres and no Docker): the old block fails with exactly
  `HQ FAIL: expected 10 regions, found 0` on an empty table and passes once rows exist; the new
  block applies on empty, populated and re-run databases, and the real 55 → 72 sequence yields
  10/10 regions and 58/58 divisions with correct values (`AD`→Ngaoundéré, `SW`→Buea, `CM001001`
  Djérem→Tibati, `CM010005` Meme→Kumba). `validate/140` passes against that database.
- **`headquarters-migration.test.ts` now forbids the pattern**, not just this instance: it asserts
  no `count(*) into ... from public.regions;` without a predicate, and that each spot-check is
  existence-guarded. Verified by reintroducing the old count — the test fails.

### Region and division headquarters

- **The hierarchy stored a name for every level but never the seat of each administration.**
  `regions` and `divisions` had no `headquarters`, so a selector could offer "Dja-et-Lobo" with no
  way to say its capital is Sangmélima. Migration
  `20260101000072_region_and_division_headquarters.sql` adds a nullable `headquarters text` to both
  and backfills **10/10 regions and 58/58 divisions** from `region_headquarters` /
  `division_headquarters` in the supplied CSVs. Subdivisions get **no** column: the dataset has no
  value for them, and a subdivision's seat is the subdivision itself, so any value would duplicate
  `name` or be invented.
- **Headquarters is TEXT, not a foreign key, and this is not an oversight.** Pointing it at a
  subdivision does not work with this dataset: a region's capital is a *city*, while the
  subdivisions of Mfoundi are `Yaoundé 1er` .. `Yaoundé 7e` — none is named `Yaoundé`. Only 1 of
  the 10 regional capitals (Buea) is an exact subdivision name, and 16 of the 58 division capitals
  are not either (`Douala` in Wouri, `Bamenda` in Mezam, …). An FK would fail on most rows or force
  the capital to be renamed to a subdivision it is not.
- **`update ... where code = '...'` succeeds while touching zero rows.** A mis-keyed code is
  therefore silent, and this migration had two chances to hit it: the CSV's region codes are
  `WE`/`SO` where this schema uses `OU`/`SU`, and the division codes are this schema's own
  `CM005004` (Wouri) rather than a positional guess. The first draft of the validation script
  asserted `CM005002` for Wouri — which is **Nkam** — and would have failed the run. Map divisions
  by folded name *within their region*, never by ordinal position, and assert every code against
  the seed.
- **The ten regional capitals were cross-checked against the published list before being written**
  (Ngaoundéré, Yaoundé, Bertoua, Maroua, Douala, Garoua, Bamenda, Bafoussam, Ebolowa, Buea), not
  taken on trust from a column heading.
- **The backfill asserts its own completeness and aborts the transaction otherwise**, including a
  check that `subdivisions` did *not* gain the column. `headquarters-migration.test.ts` (12) pins
  the same invariants without a database, and was proven by breaking the migration: swapping `OU`
  for the CSV's `WE` fails two tests.
- **The columns are nullable and blank-guarded.** Nullable because a database with the hierarchy
  but not this dataset must keep working; the `*_headquarters_not_blank` check rejects `'   '`,
  which would otherwise pass an `is not null` test and render as an empty cell.
- **`src/lib/content/regions.ts` deliberately does not carry headquarters.** That module is the
  static fallback for selector labels and quote validation; nothing renders a capital, so adding an
  unused field would be a second copy of the dataset waiting to drift.

### Geography reference data: dropdowns instead of typed locations

- **The supplied CSVs are a name correction to an existing dataset, not a second
  dataset.** `cameroon_regions.csv` / `_divisions.csv` / `_subdivisions.csv` carry the
  same 10 / 58 / 360 hierarchy as
  `20260101000055_cameroon_divisions_and_subdivisions.sql` (verified row-for-row; the
  per-region `division_count` column sums to 58 and the subdivision column to 360, so
  the CSV is internally consistent too). Migration
  `20260101000071_geography_reference_data.sql` adopts only the **34 genuinely
  corrected names** (`Ngaoundere` -> `Ngaoundéré`, `Ekondo Titi` -> `Ekondo-Titi`,
  `Upper Bayang` -> `Upper-Bayang`, …) and leaves every `slug` alone, so no filtered
  or localized URL moves.
- **The CSV code scheme is deliberately NOT adopted.** CSVs use `CM-AD` / `CM-AD-DJE`
  / `CM-AD-DJE-01`; production uses `AD` / `CM001001` / `CM001001001`. Re-coding would
  (a) violate `regions_code_format` (`^[A-Z]{2,4}$` rejects `CM-AD`), and (b) break
  every row already referencing the hierarchy plus `src/lib/real-estate/import.ts`,
  which maps by code. The app selects and links by **slug**; a code is an internal
  key. `geography-reference-migration.test.ts` asserts no `set code =` exists.
- **Two CSV rows are rejected on purpose, and the test pins the rejection.**
  `CM-ES-LD` "Lom-et-Djerem" is *unaccented* while the stored `Lom-et-Djérem` is
  correct — applying it would be a regression. `CM-CE-NS` "Nyong-et-So’o" differs only
  in apostrophe style (typographic vs ASCII) and this repo stores ASCII. A naive
  "apply every CSV name" script gets both wrong; check the direction of the
  correction, not just that the strings differ.
- **`regions.csv` changes nothing.** Its ten names match; the only differences are the
  code scheme and `North-West`/`South-West` hyphenation, where the business brief's own
  wording ("Northwest", "Southwest") matches what is stored. The brief wins over a CSV
  for a business-facing spelling.
- **A composite FK is not enforced when any of its columns is NULL.** `MATCH SIMPLE`
  (the default) skips the check, so a row with `subdivision_id` but no `division_id`
  would pass a `foreign key (subdivision_id, division_id, region_id)`. Every table that
  gained the columns also gained a `*_geography_depth` CHECK (`subdivision_id is null
  or division_id is not null`). Do not add a composite FK without the depth check.
- **`on delete set null` on the parent silently disables the child's composite FK.**
  `region_id` is `on delete set null` on `electrical_projects`, `agent_profiles`,
  `inquiries` and `profiles`. Deleting a region nulls it, which (see above) stops the
  composite FK being checked — leaving a `division_id` pointing into a region that no
  longer exists. The `clear_deeper_geography_on_region_clear` trigger (one function,
  four triggers) nulls the deeper levels whenever the region is cleared. `validate/130`
  proves it.
- **The new columns are nullable on purpose.** An existing row written before the
  migration must stay valid, and a record may legitimately be captured before the
  deeper level is known. `validate/130` asserts all 8 are `is_nullable = 'YES'`.
- **`property_listings.locality` stays free text.** A neighbourhood/quarter is not an
  administrative level in the vetted dataset, and inventing a `neighbourhoods` table
  would be fabricating geography. Do not "complete" the hierarchy by guessing.
- **`property_listings` already had `region_id`/`division_id`/`subdivision_id` with
  composite FKs** (migration 18). Only the four tables that stored *just* a region
  needed the new columns.
- **`quote_requests` is not a table.** The audit note refers to the quote-request
  columns that migration 14 added **to `inquiries`** (`property_type`, `region_id`,
  `locality`, `contact_method`). Adding a separate table would be a duplicate.
- **A new function created after migration 41 keeps Supabase's default browser grant.**
  Migration 71 creates two: `geography_reference_tree` (read-only, `security invoker`,
  deliberately granted to `anon`/`authenticated` so the public filter can call it) and
  the trigger function (revoked). `geography_reference_tree` is now on the allow-list
  in `supabase/validate/30_function_execute_hardening.sql`; add any future function
  there in the same change.
- **Use `geography_reference_tree()` rather than three round trips.** It returns the
  whole Region -> Division -> Subdivision tree in one ordered read, which is what the
  cascading selectors need; three separate reads are three chances to render a
  half-built cascade. `listing_geography_counts()` (migration 30) remains the source of
  **real** per-node listing counts — never invent a count.
- **Verify SQL with a parser before trusting it.** `pglast` (`pip install pglast`)
  parses the whole file without a database and caught a real bug here: `'Sa'a'` and
  `'Ma'an'` are unescaped apostrophes that break the statement. PostgreSQL needs
  `'Sa''a'`. No TypeScript test and no amount of reading catches that.

### Migration-time seeding gotchas worth not rediscovering

- **Supabase applies migrations before `seed.sql`, so a migration that selects from `departments`
  silently inserts nothing.** `20260101000040_store_default_categories.sql` and
  `20260101000045_electrical_solar_packages.sql` both insert by joining `public.departments`, but
  the department rows only ever came from `supabase/seed.sql`. On a fresh database both matched zero
  rows and did nothing: no store categories, no solar products, and the admin "Add a product" page
  rendering its "store is not connected" notice. It stayed invisible because local work is checked
  against a database that was seeded once and kept, and because this harness previously declared its
  own fixtures. `20260101000048_seed_departments_and_rerun_catalogue.sql` moves the three departments
  into the schema and re-runs both inserts. Anything a migration needs to reference must be created
  by a migration, not by `seed.sql`.
- **The validate harness was not actually runnable on its own.** Its files declare their own
  department and category fixtures, so `10_store_behaviour.sql` passed even when the migrations had
  seeded nothing. `60_catalogue_seed_behaviour.sql` now asserts the migration set alone produces the
  departments, the 5 store categories, the 4 solar categories and the 9 published solar products, so
  a future migration that depends on `seed.sql` fails the harness instead of shipping.
- **Publishing a product needs its media first, and `products_publish_requires_media` is a BEFORE
  INSERT trigger.** A seed cannot insert a product already-published and attach its media in the same
  statement: the trigger fires on the insert and raises. The pattern that works — and that the
  admin flow already follows — is insert as `draft`, insert `product_media`, then `update … set
publish_state = 'published'`. The original `20260101000045` inserted `published` directly and would
  have failed on any fresh database for that reason too.
- **A validation assertion written as a global row count breaks the moment the migration set seeds
  real data.** `10_store_behaviour.sql` asserted `anon sees exactly 1 product`, which was true only
  while the migrations seeded none. It is now scoped to its own fixtures (the published `thinkpad-x1`
  is visible to `anon`, the draft-category `hidden-product` is not), which is what it was actually
  trying to prove.
- **A dev-only seed of demo users belongs in a script, not a migration.** Demo accounts, when they
  are needed for local work, are created by direct `auth.users`/`auth.identities`/`profiles` inserts
  via a throwaway SQL script (bcrypt password through `crypt(..., gen_salt('bf'))`); they must never
  reach a migration, because a migration runs on production. No such script is committed to this
  repository: a committed script carrying a known password is a credential in version control, and
  `scripts/seed-demo-users.sql` was removed for that reason. Provision local accounts ad hoc and do
  not commit them.

### Department-scoped authoring and posting (Feature A + B)

- **Feature A — admins and department staff can post with images.** Migration
  `20260101000049_insight_media_and_department_authoring.sql` adds `insight_media` (mirroring
  `project_media`: storage-relative path, required translatable `alt_text`, optional caption/credit)
  and replaces the `insights_write_admin` policy with `insights_write_department`, so a department's
  staff and admins author their own posts. `src/components/admin/InsightGalleryForm.tsx` +
  `uploadInsightGalleryAction`/`removeInsightGalleryImageAction` attach images to the `content-media`
  bucket. The body renderer gained image placement so a gallery image can be referenced inline.
- **Feature B — a product's department is chosen when it is created.** Migration
  `20260101000050_department_scoped_store.sql` replaces the `is_admin()` store write policies with
  the `is_department_editor` predicate, reached by joining
  `products -> product_categories -> departments`. The admin console gained a department picker
  (`ProductForm`) that narrows the category list to the chosen department; a super admin sees every
  department, a department editor sees only their own. `listProductsForAdmin` and
  `loadProductForAdmin` are both scoped to `departmentSlugs`, so a guessed cross-department product
  id 404s rather than opening a form the write policy would refuse.
- **A product's department is its category's, read from the database — never from the form.** The
  submitted `department` field is a UI convenience only; `createProductAction` re-reads
  `product_categories.departments(slug)` and checks `canAccessDepartment`. The category picker
  filter is not a control.
- **A new `SECURITY DEFINER` trigger function must still be revoked by hand.** Supabase grants
  `EXECUTE` to `anon`/`authenticated` on every new function, and the Phase 12 hardening migration
  ran _before_ `20260101000049` created `sync_insight_media_translation_index`, so the revoke is
  repeated in the same migration that creates it. Add a function in a later migration and you must
  classify it there too.

### SEO / Lighthouse hardening (all locales and departments)

- **Every public route was measured at SEO 100 / accessibility 100 / best-practices 100** across
  `/`, `/en`, `/fr` and the three departments (EN+FR), plus about/contact/services/store/packages/
  listings/insights/gallery. The two defects fixed to get there were both real:
  - **The department hero's primary CTA was white-on-bright-accent.** On an ink band the accent
    resolves to `--dept-accent-bright` (`#6FA8F5` / `#F0A94A`), where white is ~2:1. It now uses the
    `accentOnInk` pairing (`text-ink-950` on `bg-dept-accent-bright`). `theme-contrast.test.ts`
    asserts ink-on-bright passes AA and white-on-bright does not, per department.
  - **The compact language switcher's accessible name did not contain its visible text.** The label
    is now `"EN — English"`, so `label-content-name-mismatch` passes.
- **`metadataBase` belongs in the root layout.** The gateway's own `metadata` export uses a relative
  `canonical: "/"`; without a base that emits `<link rel="canonical" href="/">`, which Lighthouse
  reports as "Document does not have a valid rel=canonical". It is now `getSiteUrl()` in
  `src/app/layout.tsx`.
- **`next/image` rejects a Supabase host pinned to `https` when the local stack is `http://`.** The
  `remotePatterns` entry now derives protocol, hostname **and port** from `NEXT_PUBLIC_SUPABASE_URL`,
  and `dangerouslyAllowLocalIP` is set only when that host is loopback — so production (a public
  https host) is unchanged. A pattern without the `:54321` port does not match a URL that has one,
  and `dangerouslyAllowLocalIP: false` answers 400 from the optimizer with no other clue.
- **Local performance numbers under default Lantern throttling are not trustworthy on this app.**
  Mobile `/en` measured 77 under Lantern with a simulated LCP of 4.9s (Load Time 4.2s on the hero
  image); with `--throttling-method=devtools` the same page measured 95 with LCP 2.0s. Use applied
  throttling before chasing a simulated-LCP regression — the repo has hit this before.
- **`html[lang]` is still `en` on `/fr`.** This is the pre-existing documented defect (the locale
  segment is below the root layout); it does not affect the Lighthouse SEO score, which reads the
  served metadata. Fixing it is a route restructure, not a feature change.

### Customer account hub

- **The public header's account action is session-aware, and it points a customer at `/account`, not
  `/admin`.** `AccountAction` is a client island that renders the static "Sign in" link (so the
  shared header stays a Server Component and every public page keeps its prerendered HTML) and swaps
  to "Your account" once `useHasSession` sees the browser cookie. `postSignInPathFor(role, locale)`
  in `src/lib/auth/redirects.ts` decides the landing: admin/staff roles → the **non-localized**
  `/admin` console, everyone else → the localized `/{locale}/account`. The two destinations do not
  share a URL shape, and assuming they did sent staff to `/{locale}/admin`, which 404s. Previously
  the header always linked to `/admin/login` and the post-sign-in redirect always went to `/admin`,
  so a customer was sent to the console only to be refused there — for signing in correctly.
- **Sign-in is a Server Action, so it sets the auth cookie without emitting a browser auth event.**
  `useHasSession` therefore re-reads on `usePathname()` change as well as on `onAuthStateChange` and
  window focus; without the pathname dependency the header kept showing "Sign in" on the account page
  until a manual reload, even though the session was live.
- **`/[locale]/account` is the customer hub, and each tile links to the owning surface rather than
  reimplementing it.** Orders link to the store's order history, favourites and saved searches link
  into Real Estate. It is `force-dynamic` because it reads the session cookie; counts come from
  loaders that already return empty on failure, so an outage degrades to "0", not an error page.
  `resolveOrderDepartments` (in `src/lib/orders/queries.ts`) maps an order to its storefront
  department so an order placed in Electrical Services links to the Electrical Services order page
  instead of the default Digital Marketing store.
- **A seeded solar package has a `storage_path` placeholder with no Storage object behind it.** Its
  real imagery ships in `public/products/electrical/`. `productImageSrc(image, sku)` (in
  `src/lib/store/storage.ts`) resolves a bundled public path first, then a seeded package matched by
  SKU, then the Storage URL; every storefront surface (card, gallery, detail, cart) calls it. Reading
  the raw `storage_path` produced a `next/image` request the optimizer answered with 400 and a
  broken-image box on every package in the store. The admin product page deliberately shows only the
  uploaded asset (`image?.storagePath`), because rendering the bundled brochure image there would
  imply an upload the editor could replace.
- **`ProductImage.storagePath` is now `string | null`, with an optional `publicPath`.** `next/image`
  takes either a Storage URL or a public path, never both, so they are modelled as distinct fields
  rather than one overloaded string.
- **No demo accounts are committed to this repository.** Nine demo accounts (one per role, password
  `DemoPass!2026`) existed briefly so the customer experience could be demonstrated, provisioned by
  `scripts/seed-demo-users.sql`. Both the accounts and the script were removed: a committed seed with
  a known password is a credential in version control, and the accounts themselves are a live
  known-credential on any environment they are applied to. Never reintroduce either. Provision a
  local account ad hoc when a role needs exercising, and delete it afterwards.

### Header cart access and the Electrical Services brand strip

- **The header cart icon is a client island fed by a JSON endpoint, because reading the cart cookie
  in the shared header would make every public page dynamic.** The header must stay statically
  renderable so the prerendered HTML the SEO layer depends on survives, so `CartAction`
  (`src/components/layout/CartAction.tsx`) renders a cart link with no server count and
  `GET /api/cart/summary` (`src/app/api/cart/summary/route.ts`, `force-dynamic`) supplies the badge
  afterwards. The endpoint returns only `{ itemCount, href }` — never lines, prices or the cart
  token — and is scoped to the caller's own httpOnly cart cookie, so it cannot read another
  visitor's basket.
- **`useCartSummary` is an external store (`useSyncExternalStore`), not `setState` in an effect.**
  `AddToCartButton` and `PackageCartControls` call `requestCartSummary(locale, pathname)` after a
  successful add, which nudges every mounted header to re-fetch. The fetch is guarded off when
  `window`/`fetch` is absent so the component renders in tests and during SSR without a request.
- **The cart path is department-scoped, resolved from the cart's first line.**
  `cartPathFor(locale, departmentSlug)` (in `src/lib/store/product-path.ts`) builds
  `/{locale}/{department}/store/cart`; `getCartSummary` reads the department from `cart.lines[0]`
  (mirroring `resolveOrderDepartments` for orders) and falls back to Digital Marketing when the cart
  is empty. A link built from the default department alone would drop a customer into the wrong
  store's cart.
- **"OUR BRANDS" is a plain data module, not CMS content.** `src/lib/content/electrical-brands.ts`
  holds the two entries the brief names — SAKO POWER for solar components and HIKVISION for CCTV
  components — as **message keys**, so the copy localizes through the same dictionary as the rest of
  the UI. `BrandStrip` renders them in a `SectionBand` on the Electrical Services department page.
- **The brand strip is gated to Electrical Services, like the product showcase.** The page renders
  `ProductShowcase` (01) and `BrandStrip` (02) only for `electrical-services`; the shared
  services/process/why sections then number from the same offset (`sectionNumber`), so ES reads
  01-05 while Digital Marketing keeps its original 02-04. Hard-coding the shared numbers instead of
  deriving the offset prints a gap (or a duplicate) on one of the two departments.

### Authoring images from the editor's device (products, articles, property, projects)

- **Every media form posts the device file to a Server Action, and Next refuses a request body over
  `experimental.serverActions.bodySizeLimit` — 1 MB by default — before the action's code runs.**
  So the whole "upload an image from your device" feature was dead on arrival for any real
  photograph: a 2-8 MB phone photo was rejected with nothing the editor could act on. `next.config.ts`
  now sets `bodySizeLimit` from `SERVER_ACTION_BODY_SIZE_LIMIT` (`src/lib/uploads/limits.ts`), the
  largest accepted image plus multipart overhead. The build carries the value —
  `bodySizeLimit: 12582912` in `.next/required-server-files.json` — and the runtime reads it from
  `serverConfig.experimental.serverActions.bodySizeLimit`. If a future bucket limit rises above the
  derived ceiling, this must rise with it, or the failure returns silently.
- **The byte limits live in `src/lib/uploads/limits.ts`, a module with no imports of its own.** They
  used to live in `validation.ts`, which imports `node:crypto` — fine for the server, wrong for a
  Client Component that only wants a number. `next.config.ts` also has to reach them: it is
  transpiled standalone before the `@/` alias exists, so it can only import a leaf module by
  relative path, the same constraint that keeps `src/lib/config/redirects.ts` a leaf. `validation.ts`
  re-exports the constants so existing importers are unchanged.
- **Create and image are still two steps, but the gap is now bridged.** `ProductForm`, `InsightForm`
  and `ListingForm` deliberately carry no image field — the record must exist before an object can
  be namespaced under its id, and a single multipart body that both creates a row and uploads to a
  bucket has no clean rollback if the upload fails. What was missing was the _signpost_: the create
  forms now render a link to the detail page ("Add an image" / "Add property images") in their
  success notice, so "create then add image" is discoverable rather than something the editor has to
  infer.
- **A too-large file is now caught in the browser, before the bytes cross the network.** Each media
  form checks the chosen file against its own kind's limit in `onChange` and shows the `too_large`
  message, with the accepted size and formats stated under the input. This is a courtesy only — the
  server still validates the real bytes in `validation.ts`.
- **`insight` cover and gallery uploads are the same shape as the other media forms** but resolve
  their kind from the article's bucket (`content-image`, 5 MB), and property photography is the
  largest at 10 MB — which is why it sets the editor ceiling the Server Action limit derives from.

### Role assignment and the installable app (PWA)

- **A super admin changes roles from `/admin/users`; the boundary is RLS, not the page guard.**
  `changeUserRoleAction` (`src/lib/admin/role-actions.ts`) re-authorizes, validates with
  `roleChangeSchema`, and writes with the **cookie-bound** client, so `profiles_update_super_admin`
  (`using`/`with check` both `is_super_admin()`) is what actually refuses a lesser role. Using the
  service-role client here would bypass the very policy that makes the boundary real.
  `supabase/validate/80_role_change_behaviour.sql` proves it: a super admin's change lands, a
  department admin's and a self-change are refused.
- **`ASSIGNABLE_ROLES` is the one list, shared by the picker and the action.** It lives in
  `src/lib/auth/role-assignment.ts` with no `"use server"` directive and no server-only import, so
  the Client Component can read it; the action validates against the same tuple. It excludes
  `visitor` on purpose (that models an anonymous request, not an account), and
  `role-assignment.test.ts` asserts it is exactly `APP_ROLES` minus `visitor` and that every entry
  has a `roleName.*` key, so the duplication cannot drift.
- **A super admin cannot change their own role, and the database would allow it.** The check is in
  the action because it is a lockout guard, not a privilege one: if the only super admin demotes
  themselves no remaining account can grant the role back through the console, and recovery becomes
  a manual SQL edit. `forbid_self_role_change` is a second line of defence for the direct-write path.
- **The install banner must not be mounted in the root layout, and the service worker must be.**
  A worker's scope is a directory of the origin, so `/sw.js` controls `/` and below whether or not
  the console registers it — registration therefore belongs in the **root layout** (one place, all
  routes) and the worker's own `NEVER_CACHE` list is what excludes `/admin`, `/api` and `/auth`.
  The banner is the opposite: it must cover the language-neutral gateway `/` and must not float over
  the console, which is exactly the `(site)` group layout. `pwa.test.ts` pins both placements, since
  neither mistake errors — it just yields a console with a banner or a gateway with no install.
- **The banner derives its locale from the pathname, not a prop.** `/` has no locale segment and
  reading `headers()` there would turn the statically prerendered gateway dynamic (the build shows
  `○ /`; keep it that way). `stripLocaleFromPath(usePathname())` gives the same answer on `/en`, on
  `/fr` and on `/`, and stays correct across a client-side language switch.
- **`window.matchMedia` does not exist in jsdom, and a component that reads it during render throws
  rather than degrading.** `src/test/setup.ts` installs a global stub reporting "no match" — the
  state a fresh browser is in — so `useSyncExternalStore`-based media queries work in tests. This
  was the only change needed; the alternative of stubbing per test still failed, because the async
  re-render flushes effects after `afterEach` tore the local stub down.
- **The offline fallback is precached per locale (`/en/offline`, `/fr/offline`), not as `/offline`.**
  `/offline` is rewritten to a locale by `src/proxy.ts`, so precaching it would depend on
  redirect-following in `cache.addAll` and would pin every visitor to whichever language the proxy
  guessed for the worker's own request. The worker picks the fallback from the failed URL's prefix.
- **Icon dimensions in the manifest are a claim about a file, so the test reads the bytes.**
  `pwa.test.ts` parses the PNG IHDR chunk for every declared icon and asserts the real width/height
  equals `sizes`, because a wrong-sized icon does not error — the install prompt just never appears,
  which is indistinguishable from "the visitor is not eligible yet".

See `docs/PROJECT_BRIEF.md` for the phase roadmap and the exact next step.

### Console drawer navigation, and the install-prompt hydration race

- **A `fixed` backdrop that is a later sibling of the panel it is meant to sit behind wins the
  `z-index` tie and swallows every tap.** `AdminSidebar`'s mobile backdrop was `fixed inset-0 z-10`
  while the `<aside>` was `position: static, z-index: auto`; a static element is painted in the
  same layer as the backdrop, and the backdrop (later in DOM order) won. `document.elementFromPoint`
  at the centre of the "CRM" link returned the backdrop button, so every tap ran `setOpen(false)`
  and nothing navigated — on both admin and staff dashboards, since they share this shell. The fix
  is a real stacking order: the mobile bar and the panel are `relative z-10`, the backdrop is
  `fixed inset-0 z-0`. **When a backdrop is a sibling rather than an ancestor, check the panel's
  computed `position` and `z-index`, not just the backdrop's** — the backdrop looked correct in
  isolation. `AdminSidebar.test.tsx` asserts the panel's `z-*` is greater than the backdrop's, which
  is the property that actually failed.
- **The mobile console had no sign-out at all.** The account menu lives in the top bar, which was
  `hidden lg:flex`, so below `lg` a signed-in phone user had no profile link and no way to sign out.
  The fix renders the _same_ `AdminUserMenu` dropdown in a second top bar that is `lg:hidden`, so a
  phone gets the identical one-tap menu a desktop user has — rather than an inline list buried at
  the bottom of the drawer, which is what a first attempt did. Two bars, one component: do not give
  the menu a second renderer (`variant="inline"`) that can drift from the dropdown. The menu is the
  **last** child of the mobile bar so its `absolute right-0` panel aligns to the bar's right edge;
  with the toggle after it, a 16rem panel overflowed the viewport by 4px at 320px. It also carries
  `max-w-[calc(100vw-1rem)]` so no future width can push it off screen.
- **An account-menu href is a link like any other, and nothing was checking it.** "Change password"
  pointed at `/admin/account/password`, a route that has never existed (the form renders on
  `/admin/profile` under `#password-heading`), so it 404'd. `navigation.test.ts` already resolves
  every `ADMIN_NAV` href against the file tree, but the account-menu hrefs were hardcoded inside the
  `"use client"` component where no test could see them. They now live in `ADMIN_ACCOUNT_LINKS` in
  the nav model, and a second assertion resolves them the same way (stripping any `#fragment`). The
  regression was proven by pointing the constant back at the dead route and watching the test fail.
- **`beforeinstallprompt` can fire before React hydrates, and it fires once per page load.** On a
  throttled mobile profile Chromium dispatched it at ~421ms while the hook's listener was only
  registered at ~442ms, so the event was lost and the banner never appeared on mobile (desktop
  hydrated first, which is why it looked desktop-only). A tiny inline script in the root layout now
  subscribes at parse time and stashes the event on `window.__kcInstallPrompt`; the hook adopts it
  via `useSyncExternalStore`. `installPromptBootstrapScript` lives in `src/lib/pwa/install-prompt-script.ts`
  (a leaf module), **not** in the `"use client"` hook module: Next rejects calling a `"use client"`
  export from a Server Component with "Attempted to call … from the server but … is on the client".
  `InstallPrompt.test.tsx` covers adopting a pre-hydration event.
- **`react-hooks/set-state-in-effect` rejects adopting the captured event with a mount `setState`.**
  The window property is genuinely external state, so the event is read through
  `useSyncExternalStore` (with the subscribe function attaching the `beforeinstallprompt` /
  `appinstalled` listeners) — the same pattern the repo already uses for `localStorage` and
  `matchMedia`. It also gives a defined server snapshot (`null`), so the server and first client
  render agree.
- **A `fixed` overlay in the `(site)` layout also lands on the auth screens, and it can swallow the
  submit button.** The install banner is `fixed inset-x-3 bottom-3 z-40` and the `(site)` group
  renders `/admin/login`, `/admin/sign-up`, `/admin/forgot-password` and `/admin/reset-password`.
  At 375x667 the 190px-tall card covered the sign-in button (banner 465-655, button 489-529), so
  `elementFromPoint` at the button's centre returned the banner and the click never reached the
  form — signing in was simply impossible on a small phone, with no error and no POST. The auth
  routes now opt out of the overlay entirely, and the banner is compact below `sm` (body copy
  hidden). `InstallPrompt.test.tsx` pins both. Diagnose this shape with `elementFromPoint` on the
  control's own centre rather than by clicking: a Puppeteer `click()` on a covered element and a
  `form.requestSubmit()` both "work" and hide the bug, and a `page.click` that lands on the overlay
  produces no request and no console error at all.
- **A stale `next-server` from an earlier session holds the preview port and serves the OLD build.**
  `pkill -f "node server.js"` and a `ps | grep server.js` both miss it, because a running Next
  standalone renames its process to `next-server` — and its `cwd` reads as `(deleted)` after a
  rebuild. Every route still answers 200 from the previous build, so a fix appears not to work and
  a login failure looks like an auth defect. Match `next-server` in `/proc/*/cmdline` and confirm
  the cwd is this repo before killing, so the Supabase Studio container (also `next-server`, cwd
  `/app/apps/studio`) is left alone. Verify a restart by checking the version line in the log.

### DEYE brand and the acquisition-purpose field

- **DEYE is the third Electrical Services brand partner**, alongside SAKO POWER (solar
  components) and HIKVISION (CCTV components). It sits in `ELECTRICAL_BRANDS`
  (`src/lib/content/electrical-brands.ts`) as `deye` / "Inverters and energy storage", with the
  copy under `electricalProducts.brands.deye.category` in `en.json`/`fr.json`. The `BrandStrip`
  grid is `sm:grid-cols-2 lg:grid-cols-3` so three tiles sit on one row at `lg`.
- **The SAKO POWER and HIKVISION wordmark files shipped swapped**, so the solar card displayed the
  CCTV manufacturer's mark and vice versa. The data mapping was always right
  (`ELECTRICAL_BRANDS` pairs each name with its own path); the bytes under those two filenames were
  the wrong way round. The fix swaps the files back, verified by OCR of the served optimizer
  output: `sako-power-v2.png` reads "SAKO / SINCE 1997" and `hikvision-v2.png` reads "HIKVISION".
- **Correcting the bytes in place did not fix what the user saw, and that is the transferable
  lesson.** The corrected files kept their old paths, so the image URL never changed. Next serves
  optimized images with `max-age=14400`, and both the optimizer's cache (`X-Nextjs-Cache: HIT`) and
  the browser key their copy by that URL, so the swapped pair kept painting while every
  server-side check passed. **An asset fix that keeps the same URL is not shipped.** The files are
  now `*-v2.png`, the old names are deleted, and the markup points at a URL no cache has seen. The
  user's screenshot was OCR-ed to confirm the diagnosis: the marks read HIKVISION and SAKO POWER
  above the labels SAKO POWER and HIKVISION, i.e. exactly the swapped state.
- **Asset tests that only prove a file exists cannot catch a swap.** `electrical-brands.test.ts`
  checked that each path resolved to a complete PNG with a sane shape, and every one of those
  properties is equally true of the *wrong* file, so the suite stayed green. The component tests
  assert the brand *names*, which were correct, and a stylised wordmark is not reliably readable by
  eye in a screenshot review. The guard now asserts a structural property that survives a rename:
  SAKO POWER is a stacked lockup (name plus a "SINCE 1997" strapline, ~2:1) while HIKVISION is a
  single line of nine letters (~6:1), so the SAKO file must be under 3:1 and the HIKVISION file
  over 4:1. The paths are read from `ELECTRICAL_BRANDS` rather than written out, so the check
  follows a version bump instead of pinning a filename that no longer exists. Reintroducing the
  swap makes that test fail with a message naming the likely cause —
  verified by actually doing it, not by assuming.
- **OCR is the tool for "is this the right image?", and ASCII-art rendering is not.** Reading the
  letterforms by downsampling to a character grid gave the *opposite* answer for both files, because
  a stylised wordmark loses its distinguishing strokes at low resolution. `rapidocr-onnxruntime`
  (pip-installable, no system packages, no root) settled it in one pass; `tesseract` was unavailable
  because `apt-get` needs root. When a defect is "the content is wrong" rather than "the file is
  missing", measure the content.
- **`naturalWidth: 0` in a headless probe usually means below-the-fold lazy loading, not a broken
  image.** The brand strip sits far down `/en/electrical-services`, so the images had not been
  requested at the moment of measurement. Both the optimizer URL and the static file returned 200
  with the right byte counts; the reliable check is to fetch the served bytes and inspect *those*,
  not to read `naturalWidth` on a page that never scrolled.

- **A property enquiry can now state a "purpose of acquisition".** Migration
  `20260101000052_acquisition_purpose.sql` adds the `acquisition_purpose` enum
  (`residence`/`investment`/`business`/`other`) and a nullable `inquiries.acquisition_purpose`
  column with a partial index. It is optional end to end: the form's empty "prefer not to say"
  option normalises to `undefined` in `listingInquirySchema` and is stored as null, so an enquiry
  is never blocked on it. The CRM detail page shows it only when present.
- **The purpose values are a mirror of the database enum, and the mirror is asserted.** The Zod
  enum in `src/lib/validation/listing-inquiry.ts` is a second source of truth, so
  `listing-inquiry.test.ts` reads the migration and asserts the member set — the same guard
  `real-estate/enums.test.ts` applies to its mirrors. Add a value to one and not the other and the
  test fails, rather than the insert failing on a constraint after passing validation.
- **This is a property-enquiry field, not a general one.** It is only collected on
  `ListingInquiryForm` and only ever set for a `property_inquiry`/`viewing_request` source; every
  other inquiry leaves it null. Do not add it to the corporate contact form or the quote form —
  neither has an acquisition to speak of.

### Insight article translation (the missing write path)

- **`'insight'` was a valid `translatable_entity_type` and the read path already served French, but
  nothing ever wrote the French rows.** `loadInsightRecords` selects from `content_translations`
  where `entity_type = 'insight'` and `localizeInsight` merges title/summary/body — but there was no
  `sync_insight_translation_index` trigger. Products (migration 12), electrical projects (14),
  property listings (22) and insight _media_ (49) each had one; the article's own text did not. So an
  article published by staff stored English once, `/fr` found no overlay, `resolveLocalized` fell
  back to canonical, and the French page silently served English — with no `translation_entries`
  row, no `content_translations` row and no queued job, so nothing downstream could fix it either.
  Migration `20260101000053_insight_translation_index.sql` adds the trigger, the source/target rows,
  the queued jobs and a backfill for existing articles.
- **A trigger is the right place, for the same reason it was for products.** The index becomes a
  property of the data, so an article written by the admin form, a migration or a psql session is
  indexed alike. Doing it in `createInsightAction`/`updateInsightAction` would leave any other write
  path unindexed — and the `content_translations` insert the action would need is a `SECURITY
DEFINER`-adjacent write the cookie-bound client may not be allowed to make.
- **The field list is title/summary/body and nothing else.** It is exactly what `localizeInsight`
  merges and `groupTranslations` understands. `slug` is deliberately excluded: the article route
  resolves the canonical slug in both locales and there is no `insight_slugs` table, so indexing it
  would create Tolgee keys nothing reads. The two `entity_seo` fields the product/listing triggers
  index are excluded too — `loadInsightRecords` does not read `entity_seo` for insights.
- **A new function created after migration 41 keeps Supabase's default browser grant.** The Phase 12
  hardening ran _before_ this migration existed, so `insight_translatable_fields()` (not a trigger
  function) would otherwise stay executable by `anon`/`authenticated` and fail the _subset_
  assertion in `30_function_execute_hardening.sql`. The revoke is repeated in the same migration that
  creates it. Any later migration that adds a function must classify it the same way.
- **A backfill is required, not optional.** Articles written before the trigger have no index rows;
  without the backfill in the migration they would stay English forever. It creates only what is
  missing (`on conflict do nothing` for the French rows, so an existing translation is never
  destroyed) and enqueues jobs only for the entries it actually created, so re-running is safe.
- **`now()` is transaction-constant, which breaks a naive "source moved on" test.** In
  `supabase/validate/70_insight_translation_behaviour.sql` the French row's `source_updated_at` is
  backdated an hour before the English edit; writing both inside one transaction would give identical
  timestamps and the `outdated` branch would never be reached. `pg_sleep` does not help — `now()` is
  the transaction start time, not the statement time.
- **`insights_summary_length` requires `char_length >= 1`, so `''` cannot be inserted.** The
  blank-field guard is exercised with `'   '` (whitespace), which passes the length check but is
  empty after `btrim` — the case the trigger's guard actually exists for.
- **This makes the index rows and queued jobs correct; it does not by itself produce French.** The
  translation system is push-only: `pushTranslation` sends the source and any existing French to
  Tolgee, but `fetchTranslation` has no callers, there is no cron, no Tolgee webhook route and no
  machine-translation provider wired in. So a French value reaches the site only when it is written
  to `content_translations` — by a seed migration (as 45/48 do for the solar packages), by a
  translator via an admin surface, or by an MT/Tolgee pull-back workflow that does not exist yet.
  Do not describe the site as machine-translating EN→FR: it is not, and no provider/credentials for
  one have been chosen.

### Account capabilities and listing ownership (Phase 1.1/1.2)

- **`profiles.role` is authorization; a `real_estate_memberships` row is a capability, and the two
  never imply each other.** `role` decides whether a caller reaches the internal console and is
  never self-assigned (migration 24). A capability decides whether a customer may act as a landlord
  or an agent on the marketplace, is additive to a buyer account, and a user may hold both. Landlord
  and agent are separate rows (one per `(user, membership_type)`), not a role.
- **A `with check` clause guards the destination state; it does not guard the source row.** RLS
  `using` decides which rows a policy lets you target, and `with check` decides what the row may look
  like afterwards. `real_estate_memberships_update_own` (migration 57) had
  `using (user_id = auth.uid())` and a `with check` pinning the _new_ status to the pending states —
  which looked like a self-escalation guard but let the owner target their own row in ANY state and
  move it to `pending_review`. Reproduced against the harness: an owner reset an **approved**
  membership and cleared a staff **suspension** (with its reason), both contradicting the migration's
  own comment ("and nothing else") and making `applyForMembershipAction`'s `already_member` branch
  dead code. `20260101000059_membership_owner_update_scope.sql` narrows `using` to
  `APPLICANT_SETTABLE_STATUSES ∪ REAPPLICABLE_MEMBERSHIP_STATUSES` (pending states plus
  `rejected`/`changes_requested`); `approved` and `suspended` are reachable only through the staff
  policy. `memberships.test.ts` now extracts the policy's `using` clause from the latest migration
  and asserts it matches those two constants, so the drift cannot recur silently.
- **The capability model cannot be proven by the application, only by the database.** A Server
  Action's role check is a _message_; the boundary is the RLS policy. `supabase/validate/100_account_capabilities_behaviour.sql`
  asserts residency constraints, the capability/authorization split, and the ownership boundary
  (one landlord cannot reach another's listing; a non-agent cannot be recorded as manager). The
  owner-update source-state guard is asserted inside migration 59's own `do $$ … $$` block, because
  the harness runs the migrations before the validate scripts and a regression should abort the
  migration rather than ship.
- **Region names come from `regions.name_fr`, and a public surface that renders a region must join
  it.** The English name is `name`; a French page that read `name` alone showed "Far North" among
  otherwise-French copy. `localizeGeographyName(row, locale)` (in `geography.ts`) is the single
  localizer; `localizeListing` applies it to `regionName` on every path (including the source-locale
  and no-overlay early returns), and `LISTING_SELECT`/the region-options loader embed
  `regions (slug, name, name_fr)`. The names themselves are the vetted Open Admin Data dataset
  (CC BY 4.0), seeded by migration — never invented.
- **The geography source is the vetted dataset, not hand-typed rows.** Migration
  `20260101000055_cameroon_divisions_and_subdivisions.sql` carries the 10 regions, 58 divisions and
  360 subdivisions from "Cameroon Administrative Divisions" (Open Admin Data, CC BY 4.0), and
  re-states the ten regions rather than assuming `seed.sql` ran (migrations apply before seeding).
  Do not add or edit an administrative row by hand: extend the dataset and re-generate.

### KYC verification gotchas worth not rediscovering

- **A capability must be written by one function and nothing else.** The brief's central rule is
  that a user-selected account type never grants posting permissions, so `approve_kyc_application`
  is the only writer of `real_estate_memberships.status = 'approved'`, it is `security definer`,
  and it is granted to `service_role` only. `declared_account_type` on `profiles` is a declaration:
  no RLS policy reads it, and `kyc.test.ts` scans every `create policy` body in the migrations to
  assert that. If a future policy needs the declaration, the rule has been broken, not extended.
- **`isKycReviewerRole` is narrower than `isRealEstateAdminRole` on purpose.** A normal
  real-estate administrator manages listings and must NOT decide identity; the reviewer set is
  `["super_admin"]` and `roles.test.ts` asserts it matches `is_super_admin()` in the SQL. Do not
  "simplify" the KYC console guard to `isRealEstateAdminRole` — that silently widens the decision.
- **The applicant's write policies are state-scoped, so a rejected row can be resubmitted but an
  approved one cannot.** `kyc_applications_update_own`'s `using` admits draft/submitted/rejected/
  changes_requested and its `with check` holds the destination to draft/submitted with a null
  reviewer, so an update can never move a row into `approved`. The application offers the
  resubmit form for exactly the states the policy admits.
- **A field-error message key that no dictionary defines renders its raw key, not blank.** The KYC
  actions return stable keys (`errFullLegalName`, `videoConsent`, …) that the form maps through
  `KYC_ERROR_KEYS`; every one must exist under `account.kyc` in both `en.json` and `fr.json`, or the
  applicant sees `account.kyc.errPhone` as visible text. `KYC_ERROR_KEYS` is the map the convention
  uses (`SIGN_UP_ERROR_KEYS`, `CHECKOUT_ERROR_KEYS`); add a field, add its key to all three places.
- **A signed URL is the only way a KYC document is read, and only one loader returns a path.**
  `loadKycDocumentPath` / the review action are super-admin-gated and the URL expires in 300s;
  every other loader drops `storage_path` so a pointer to a private object cannot reach a render
  path. `getKycDocumentUrlAction` re-checks the role and records a `document_viewed` event, so a
  reviewer opening an identity document is a trail entry.
- **A new `security definer` function must be classified in the same migration.** Supabase grants
  `EXECUTE` to `anon`/`authenticated` on every new `public` function by default, and the Phase 12
  hardening migration ran long before these; migration 60 revokes from both and re-grants only
  `service_role`. The trigger functions (`audit_kyc_review_event`, `audit_kyc_application_status`)
  are revoked too — Postgres does not check `EXECUTE` for a trigger function, but the grant is
  still surface.
- **`handle_new_user` is replaced, not amended, so only the LAST definition counts.** Migration 61
  re-creates it to record `declared_account_type` and `date_of_birth`; the role handling is
  unchanged (still `customer`, still ignoring a metadata `role` key), and `roles.test.ts` reads the
  last definition to assert that. A test that scraped the first definition would pass against the
  version that was fixed.
- **A column shared by two audiences leaks the private one unless the read path filters it.**
  `real_estate_kyc_review_events.note` holds both a decision reason the applicant must read and a
  reviewer's private remark. `note_added` is internal by definition, but an approval's `p_note`
  lands on the `approved` event and is documented as internal too — so a loader that only dropped
  `note_added` still rendered a reviewer's approval note to the applicant. The applicant history
  now strips the note from every action except `rejected` / `changes_requested`
  (`isApplicantVisibleNote`), and a `note_added` row is dropped whole. Row-level security cannot
  hide one column, so this is a read-path responsibility; `kyc.test.ts` pins the visible set.
- **The KYC age gate is in two places for two reasons.** The signup form refuses an under-18
  applicant who declares landlord/agent, so they are told immediately; the authoritative 18+ rule
  is the `kyc_applicant_is_adult` CHECK on `real_estate_kyc_applications`, because that is where
  identity evidence is reviewed. `profiles.date_of_birth` carries no age constraint — a minor may
  hold a buyer account.

### Landlord and agent dashboards (Phase 3)

- **A dashboard is a _capability_ surface, not a role surface.** `/account/landlord` and
  `/account/agent` open for an approved `real_estate_memberships` row, never for a role and never
  for the `declared_account_type` a user picked at signup. `accessibleDashboards()` is the single
  predicate the account page links with and the routes guard with, so a link rendered there always
  resolves to a page that renders. An application that is pending or sent back is NOT linked from
  the account page: the capability card already shows its status and its action, and a second entry
  point would be a link into a "waiting" panel. That panel is reachable by direct URL, which is
  deliberate — a user mid-application can bookmark it.
- **The capability check in the Server Action is a message; RLS is the control.** `requireCapability`
  reads the caller's own approved membership so a user without one sees "apply first" instead of a
  raw policy violation, but every write goes through the cookie-bound session client, so
  `property_listings_insert_own_owner` / `..._update_own_owner` / `..._update_manager` are what
  actually scope a dashboard to its owner's rows. `loadDashboardListingById` adds no ownership
  filter for the same reason — a guessed id for another account's listing matches zero rows and the
  route 404s.
- **A landlord's listing is created as a draft with no `source` sent, and the trigger pins it to
  `owner_submission`.** Do not "helpfully" send `source` from the dashboard action: the migration
  62 pin is what puts the listing in the review workflow, and a second place that sets the value is
  the exact shape of the bug that was closed. See the gotcha below.
- **The dashboard offers no publish control, by design.** `OWNER_SETTABLE_TRANSITIONS` is
  `published→archived`, `under_offer→archived`, `archived→draft` — withdraw and reopen, nothing
  else. Publication is the reviewer's decision and `enforce_listing_lifecycle` refuses it without an
  approved submission, so a publish button would be one the database always rejects. The test
  asserts no owner-settable transition targets a public state.
- **The status control's buttons are chosen from the server-rendered listing, not from local
  state.** After a Server Action the page re-renders from the database, so the controls reflect what
  happened rather than what was requested; a client-side optimistic toggle would show "withdrawn"
  beside a row the trigger refused.
- **`DashboardPanels` / `DashboardViews` are Server Components that translate directly; only the
  interactive panels are Client Components.** The rule that a translator function cannot cross the
  Server/Client boundary (`client-boundary.test.ts`) applies to the four `"use client"` dashboard
  components, which therefore take `locale` and call `createTranslator(locale).t` themselves. The
  server-rendered panels take `locale` and translate inline — passing them a label map would be a
  hand-maintained copy of the message file.
- **The listing form is separate from the console's `ListingForm` on purpose, but reuses its field
  labels.** The console form carries operator vocabulary (import source, internal notes); the
  dashboard's user owns one property. Sharing the component would mean leaking operator concepts
  into a customer form or adding mode flags to the console's. The _labels_ come from
  `realEstate.admin.field*`, because duplicating them would be two spellings of "URL slug" waiting
  to drift.
- **An approved agent capability with no `agent_profiles` row cannot list.** `requireCapability`
  returns `agent_profile_missing` rather than proceeding, because a listing with no `agent_id` has
  no poster and the ownership trigger would reject the manager relationship anyway. The fix is a
  staff action (create the agent record), which is why the message says so.
- **`listing_private_details` is written through `set_listing_private_details`, and read through
  `listing_private_details_api`.** The column is `geometry(Point,4326)`, which PostgREST cannot
  send or return, so the RPC takes plain numbers and the `security_invoker` view returns them. Both
  are reached with the session client so `listing_private_details` RLS stays the control.
- **The gallery's object write uses the admin client; its row write uses the session client.** The
  bucket has no browser write policy, so the object upload needs the service role — but the
  `listing_media` row is gated by `listing_media_write_own_owner`, which is what actually scopes
  which listing an object may be attached to. The object is uploaded first and removed if the row
  insert then fails, so a failed insert leaves no orphan.

### Dashboard chrome-free shell (the `(dashboard)` route group)

- **The landlord and agent dashboards render without the public marketing chrome, and the route
  group is how.** They used to live under `(site)/[locale]/`, so the sticky public header and the
  full footer wrapped the sidebar on every page and a dashboard read as a marketing page with a menu
  bolted on. They now live in `src/app/(dashboard)/[locale]/account/[dashboard]/...`, whose layout
  renders only the `SkipLink` — the same chrome-free treatment the console gets from `(static)`.
  A route group is not part of the URL, so every address is unchanged.
- **Two route groups may declare the same `[locale]` segment as long as no two pages resolve to the
  same path.** `(site)` keeps `/{locale}/account` and `/{locale}/account/kyc` (public-chrome
  pages); `(dashboard)` owns `/{locale}/account/{kind}` and its children. `kyc` is a static segment
  inside `[dashboard]`'s directory space, so it resolves against the `(site)` page; the split is
  valid because the resolved paths differ. If a future `{kind}` value collided with `kyc` the build
  would fail with a parallel-pages error, which is the check that keeps this honest.
- **A signed-in user reaches their workspace from the public site through a client island, not from
  the shared header.** The header must stay statically renderable — reading `cookies()` there would
  make every public page dynamic and cost the prerendered HTML — so `DashboardReturnAction`
  (`src/components/layout/DashboardReturnAction.tsx`) asks `GET /api/account/dashboard` and renders
  nothing until the answer arrives, the same split as `CartAction` + `/api/cart/summary`. The
  module-level store (`useDashboardHome`) is shared by the desktop bar and the mobile drawer so the
  two islands do not double the request.
- **`resolveDashboardHome` maps a console role to the non-localized `/admin` and an approved
  capability to the localized `/{locale}/account/{kind}`, and returns null for a plain customer.**
  The two destinations do not share a URL shape; the console wins when a caller is both staff and a
  capability holder. Nothing in the link is authoritative — the destination re-checks the session,
  the role and the capability server-side.
- **The dashboards deliberately do not mount the Tolgee provider.** No component under the tree
  calls `useTranslate` — the server panels use `createTranslator` and the client panels call it
  themselves (`client-boundary.test.ts` enforces the boundary) — so a provider there would be an
  unused client bundle. `force-dynamic` is on the group layout because the shell reads the session
  cookie.

### The self-publish hole: a column default is not a security boundary

- **`listing_source` defaults to `admin`, and the review gate keyed only on
  `source = 'owner_submission'`.** Before migration 62 an approved landlord could insert a listing
  without naming a source — it was born `source = 'admin'` — and then publish it directly. The
  `property_listings_insert_own_owner` policy required only `owner_id = auth.uid()` and an approved
  landlord membership; nothing pinned `source`. Reproduced on a fresh 61-migration database: the
  insert succeeded with `source = 'admin'` and the publish succeeded, with no submission row and no
  administrator involved. The review workflow was optional for exactly the users it exists to
  constrain.
- **`enforce_listing_lifecycle` now pins a non-administrator write to `owner_submission`** on
  INSERT, and refuses any attempt by such a caller to _set_ a different source on UPDATE. An
  administrator's write is untouched, so `source = 'admin'` (console) and `source = 'import'`
  (CSV import) keep working. The trigger had to gain `source` in its column list
  (`before insert or update of status, source`) or the anti-stripping check would never run — a
  trigger that only fires on `status` cannot see a source rewrite.
- **The trust predicate is `auth.uid() is null or is_real_estate_admin()`.** `auth.uid() is null`
  is the trusted-context case — service role, psql, a migration, the validation harness — and it is
  the same convention `forbid_self_role_change` uses. Without it, a migration or the harness
  inserting a listing would be treated as an untrusted browser session and pinned to
  `owner_submission`.
- **A trigger or policy defect of this shape is invisible to TypeScript and to every unit test.**
  It lives in the interaction between a column default, an RLS policy and a trigger, so only a real
  database reproduces it. The `do $$` assertion at the foot of migration 62 runs on every
  migration application and proves the boundary; `owner-listing-workflow.test.ts` is the cheaper
  database-free complement that pins the _shape_ of the fix so a later edit cannot quietly remove
  it. Add a behavioural assertion to the migration when a boundary matters, not only a text test.
- **`handle_new_user` provisions a `customer` profile on insert, so a fixture that inserts an
  admin user must promote it afterwards.** `insert ... on conflict do nothing` for the auth row
  leaves the admin a customer, and the assertion then passes for the wrong reason (the "admin"
  write in case (d) would not be an administrator's at all). The migration does
  `update public.profiles set role = 'real_estate_admin'` after the auth insert.
- **A migration that seeds its own fixture must clean up — and "delete the row" is not enough.** The
  fixture listings in migration 62 fire `sync_listing_translation_index`, which writes
  `translation_entries`, `content_translations` and `translation_sync_jobs` rows. None of those has
  a foreign key to `property_listings`, so deleting the listing cascades nothing: the block
  originally stranded 9 entries, 18 translations and 9 queued sync jobs per application — a durable
  queue of Tolgee work for listings that no longer exist. Reproduced on a fresh database by diffing
  the orphan count with and without migration 62 (+6 entries). The cleanup now deletes the entries
  and translations by fixture id **before** the listing delete (afterwards the `entity_id in
(select …)` subquery matches nothing, since the rows are already gone); the job rows then cascade
  via their `translation_entry_id` FK. Note this is the general hazard, not a migration-62 quirk: any
  fixture or application path that deletes a translatable entity must clear its translation rows.
  Migration 58's own assertion block still strands 3 entries for the same reason — pre-existing and
  already applied, so left alone rather than folded into this change.

### Marketplace redesign (Phase 4) gotchas worth not rediscovering

- **A new enum value cannot be used in the migration that adds it.** Postgres raises "unsafe use of
  new value of enum type" for `listing_sort_order` if `relevance` is added and then referenced by
  the search function in the same transaction, and Supabase runs each migration in one transaction.
  Migration 63 adds the value alone; migration 64 is the first place it may be used. This is why
  there are two migrations for one change.
- **A price filter is meaningless across currencies, so the currency predicate must travel with the
  bound.** `search_property_listings` compares `p_min_price`/`p_max_price` only among rows whose
  `p_currency` matches, and the loader sends `p_currency` whenever a bound is present (defaulting to
  XAF). Sending a bound without a currency, or comparing a XAF figure to an NGN one, is exactly what
  the brief forbids; there is no exchange-rate feed. Clearing the currency in the URL clears the
  bounds with it (`removeListingFilter("currency")`), because a bound expressed in a currency that
  is no longer selected cannot be displayed or cleared by the visitor.
- **A facet count must come from the same predicate the search uses, or it is a fabricated
  statistic.** `listing_facets()` returns category, currency and amenity counts under the identical
  public-visibility set, so a shortcut reading "12" leads to a result set of 12. The sidebar's
  currency selector and amenity checkboxes are built from the values that actually occur — never a
  fixed list — so neither can offer a choice that matches nothing.
- **A verification badge is a deliberate super-admin grant, not an inference from a KYC approval.**
  `real_estate_memberships.verified_at`/`verified_by` are written only through
  `setPublisherVerificationAction`, which uses the **session** client so
  `enforce_membership_verification` (raises unless `is_super_admin()`) is the control. The trigger
  clears the badge when a membership leaves `approved`, so a suspension revokes the public mark with
  no action here. The reviewer set is `isKycReviewerRole` (`super_admin` only), deliberately
  narrower than the real-estate administrator set. `property_listings.publisher_verified` is
  denormalized because PostgREST cannot express the `exists` subquery the card needs, and it is
  maintained by triggers on both the listing write and the membership change.
- **The trigger must look only at an incoming NON-NULL badge value.** Clearing a badge on suspension
  changes `verified_at` from a value to null; a naive "did the columns change?" test would read that
  as a badge write and refuse it, so a real-estate administrator could not suspend a verified member
  — the opposite of the intent.
- **The mobile filter drawer and the desktop sidebar are one component, not two.** `MobileFilterDrawer`
  renders the same `ListingSidebar` in its `drawer` variant inside the shared `Modal`
  (`placement="side"`), so focus trapping, Escape, scroll lock and focus return are the navigation
  drawer's behaviour and the two presentations cannot drift. The trigger reports the active-filter
  count, because "Filter" alone gives no indication that a short list is the visitor's own doing.
- **Every new `security definer` function needs its EXECUTE classified in the same migration.**
  Supabase grants `EXECUTE` to `anon`/`authenticated` on every new `public` function by default, and
  the Phase 12 hardening ran long before migration 64; `publisher_is_verified`,
  `enforce_membership_verification` and the sync triggers are revoked from both roles there.
  `search_property_listings` and `listing_facets` are deliberate public RPCs and keep their grant —
  both pin the public status set internally, so the grant is not a way to read a draft.
- **A chip is a link built from the full filter state, never a query-string splice.** Splicing would
  leave a stale `page` behind, and removing a region would strand an orphaned division in the URL the
  panel cannot display. `removeListingFilter` also drops a region's division and subdivision with it.
- **The card's save control is a nested button, not a second link.** The whole card is one link (so a
  screen reader announces one target), and `FavoriteButton` is an independently focusable button
  inside it. `ListingCard.test.tsx` pins both the single-link default and the nested button when a
  favourite state is supplied.
- **An empty `?verified=` is a cleared checkbox, not a filter.** `parseVerifiedOnly` returns
  `undefined` for `""`, `"false"` and `"0"`; only `"true"`/`"1"` enable it. Treating a bare param as
  "on" would hide listings for a visitor who had just cleared the filter.
- **A multi-image action reads `getAll("image")`, and a single-file read silently drops the rest.**
  The three upload paths (`store/media-actions.ts`, `real-estate/media-actions.ts`,
  `real-estate/dashboard-actions.ts`) append positions from the existing count and take primary only
  once (`is_primary: !primaryTaken`), so a second upload into a gallery does not demote the card
  image. `multi-image-upload.test.ts` pins the shape, since the behaviour lives inside a Server
  Action that needs a live Supabase project.
- **`setProductPrimaryImageAction` demotes before it promotes.** The partial unique index permits at
  most one primary per product, so promoting first would violate it; the test asserts the ordering
  within that function's body, not the whole module (an earlier promotion in the remove path would
  otherwise satisfy a naive ordering check).
- **The Jiji reference screenshots are a layout reference, not a data source.** No Nigerian price,
  inventory count or market statistic is copied; every number on the page comes from a published
  database row, and an empty portfolio says so. This is the brief's rule and the reason the landing
  page renders an honest empty state when there is no inventory.
- **Mobile Lighthouse performance is 96–98 on the marketplace routes under applied (`devtools`)
  throttling — the site's own home page is 91.** There is no marketplace-specific regression;
  desktop is 100/100/100/100. Do not chase the residual against the default Lantern simulation,
  which this repo has already established overstates LCP here.
- **`prettier --check` flags `src/app/(static)/admin/(console)/store/[id]/page.tsx` before this
  change too.** It is pre-existing format debt, so the minimal hand edit is correct; running
  `prettier --write` on it would add unrelated reformatting churn to a feature diff. The new test
  files were formatted with `--write` because they are new.

### Sign-up phone and residency, and the dashboard sidebar shell

- **A column that defaults to `true` fabricates a fact about every new account.** `profiles.permanent_residency`
  was `boolean not null default true`, which was fine while it was only ever set on the account page
  by a person who saw the checkbox. It is not fine as a sign-up field: a default of `true` silently
  claims every new account IS a permanent resident. Migration
  `20260101000066_signup_phone_and_residency.sql` drops the `not null` and the default so null is the
  honest third state — "not stated" — and the account page's select stores an explicit `false` for a
  stated "no". Do not reintroduce a default: an unanswered question and a stated "no" are different
  answers, and the schema now distinguishes them.
- **`handle_new_user` is replaced, not amended, so a new sign-up field must be added to its latest
  definition and nowhere else.** Migration 66 re-creates the trigger to read `phone` and
  `permanent_residency` from the sign-up metadata, carrying forward everything migration 61 did
  (locale resolution, the account-type declaration, the date-of-birth parse) and — critically — the
  rule that the role is never taken from client-supplied metadata. Its `do $$` self-test proves the
  round-trip and the escalation guard on the migration that introduces it, and the fixture deletes
  its `auth.users` rows (the profiles cascade with them).
- **A blank radio answer must stay `undefined`, not become `false`.** The sign-up action sends the
  residency value as the string `"true"`/`"false"` and omits the key when unanswered, so an absent
  answer is distinguishable from a stated "no"; the trigger turns anything else into null. Coercing
  the blank case to `false` in the schema would record a statement the user never made.
- **The landlord and agent dashboards share one route tree and one shell, and the shell is the only
  place they authenticate.** `src/app/(site)/[locale]/account/[dashboard]/{layout,page,new,[id]}`
  serves both kinds, replacing the six static `landlord/` and `agent/` pages. The layout resolves the
  dynamic `[dashboard]` segment to a kind or 404s and redirects an anonymous visitor to sign-in with
  the dashboard as the return target; it does NOT decide capability, because a viewer whose
  application is pending must still reach the dashboard and see the verification panel. The static
  `kyc` sibling wins over the dynamic segment and is unaffected.
- **The dashboard shell mirrors the admin sidebar on purpose, including its stacking rules.** The
  mobile bar is `relative z-20`, the panel `z-10` and the backdrop `z-0`. As a sibling at the same
  `z` the backdrop (later in DOM order) would win the tie and swallow every tap on a nav link — the
  exact bug the admin drawer had. `DashboardShell.test.tsx` asserts the panel's `z` is greater than
  the backdrop's, because that is the property that failed, not the markup.
- **The dashboard nav model is a leaf module, addressed by icon key.** `src/lib/real-estate/dashboard-nav.ts`
  carries no icon components (a function cannot cross into a Client Component) and builds hrefs from
  the kind and locale, so it is unit-testable without a database. `dashboard-nav.test.ts` resolves
  every href against the file tree and pins the "overview only on its exact route" highlight rule —
  a sidebar link to a 404 is one click behind the dashboard, and a missing `exact` flag leaves
  "Overview" lit on every child route.

### Session-aware header account control, department inboxes and the listings header

- **The public header renders its account control as a client island fed by one JSON endpoint,
  because reading the session in the shared layout would make every public page dynamic.**
  `AccountAction` is an icon: a `User` glyph by default, replaced by the account's own profile
  picture once `/api/account/summary` reports one. It renders the signed-out link (`/admin/login`)
  on the server and on the first client render — `useAccountSummary`'s first value is `null`, so
  there is no hydration mismatch — and swaps to the account hub once the answer arrives.
  `useAccountSummary` (`src/lib/hooks/use-account-summary.ts`) is one module-level store shared by
  every account control (desktop icon, mobile drawer item, `DashboardReturnAction`), so two islands
  do not each fetch the same session.
- **`/api/account/summary` replaced `/api/account/dashboard` and the two hooks were unified.**
  `resolveAccountSummary` (`src/lib/auth/account-summary.ts`) returns `{ signedIn, accountHref,
  name, avatarUrl, dashboard }` in one value; `DashboardReturnAction` reads `dashboard` from the
  same store rather than its own endpoint. `use-dashboard-home.ts`, `use-session.ts` and
  `api/account/dashboard/route.ts` were deleted as superseded. The endpoint carries only display
  fields — never the role or the memberships — and the destinations re-check the session, so it is a
  convenience, not a control.
- **The account hub now hosts the profile-picture form**, not only the console. `AvatarForm` is
  rendered on `/[locale]/account` under the same `account.avatar*` keys, and `uploadAvatarAction` /
  `removeAvatarAction` revalidate `/[locale]/account` as well as `/admin/profile`, so a customer who
  sets a picture sees it in the header after the revalidation.
- **Department inboxes are a distinct fact from the corporate inboxes.** `DEPARTMENT_EMAILS`
  (`src/lib/config/site.ts`) maps each `DepartmentSlug` to its own public address
  (`kcdigital@`, `kcelectrical@`, `kcrealestate@kctechc.com`). They render on the department pages,
  the department landing pages, the packages page and the contact page via
  `ContactPrompt.departmentEmail`, and in the footer's Contact column. `SITE.emails` (the corporate
  trio) is unchanged, so `site.test.ts`'s contact-block pin still holds.
- **The listings page rendered its header twice.** `real-estate/listings/page.tsx` mounted a
  standalone `SectionBand` header *and* passed the same block into the layout's `header` slot, so
  the page served two breadcrumb navs and two `id="property-search-heading"` elements (an invalid
  duplicate id and a duplicate `<h1>` region). Only the listings page did this — store and project
  pages were clean. Verified in the built HTML: exactly one `<h1>` and one
  `id="property-search-heading"` (the other grep hits are the RSC flight payload, which is normal).
- **A message key added to the top-level `errors` block must exist in both locales.** The account
  avatar form maps `no_file` / `empty` / `too_large` / `type_not_allowed` / `unknown_type` /
  `rate_limited` / `upload_failed` / `update_failed` / `unauthenticated` / `unconfigured` through
  the label map; `empty`, `type_not_allowed`, `unknown_type` and `update_failed` were missing from
  both `en.json` and `fr.json` and are now present. A missing key renders its raw name, not blank.
- **`next dev`/`next build` regenerate `.next/types/validator.ts`, so a deleted route leaves a
  stale reference that fails `tsc`.** After removing `api/account/dashboard/route.ts`, `tsc --noEmit`
  failed on `Cannot find module '../../src/app/api/account/dashboard/route.js'` until `.next` was
  removed. `rm -rf .next` before the type check, as the Phase 7 gotcha already notes.
- **Lighthouse must be run against the HTTPS preview URL, not the pod IP.** Testing
  `http://<pod-ip>:12000` reports best-practices 79 because `is-on-https` and `redirects-http` fail
  on a plain-HTTP origin — an artifact of the harness, not the app. Over
  `https://work-1-…` the same page measured SEO 100 / accessibility 100 / best-practices 100 (perf
  91 under `--throttling-method=devtools`).

### Phase 7 admin lifecycle gotchas worth not rediscovering

- **A `SECURITY DEFINER` RPC that authorizes with `is_super_admin()` must be called through the
  session client, not the service-role client.** `is_super_admin()` reads `auth.uid()`, which is the
  JWT subject; a service-role call carries none, so the guard sees an anonymous caller and refuses.
  `deleteProductAction` and `deleteInsightAction` called `delete_content_permanently` through
  `createAdminClient()` and so could never delete anything — while `deleteProjectAction` and
  `deleteListingAction`, written independently, used the session client and worked. The two clients
  share one TypeScript type, so `tsc`, ESLint and every behavioural test passed; only a real
  request would have shown it. The rule is: if the function's body checks `auth.uid()`-derived
  state, call it with the client that carries the cookie. `admin-deletion.test.ts` now reads the
  source and asserts which client each delete action invokes the RPC on. Storage-object removal
  beside it is the opposite case — the buckets have no browser write policy, so it uses the
  service-role client.
- **A cascade deletes rows, not objects.** `delete_content_permanently` deletes the product row and
  `product_media` cascades, but nothing removes the files from the bucket. `deleteInsightAction` and
  `deleteProjectAction` read the media paths and remove the objects first; `deleteProductAction` did
  not, so a deleted product left orphaned photographs. Read the paths while the rows still exist —
  after the delete the rows are gone and the paths are unrecoverable.
- **A unique before/after media slot cannot be filled by a batch.** `project_media` has a partial
  unique index permitting one `before` and one `after` per project, so the multi-file upload accepts
  a batch only for the `general` role; the form reflects that (`multiple={role === "general"}`) and
  the action refuses the combination regardless. A partial batch (`media_added_partial`) keeps the
  files that landed rather than rolling back a completed upload — the editor sees what arrived and
  retries only the refused file.
- **`.next/types/validator.ts` goes stale after a route move and fails `next build`, not `tsc`.**
  The route-group move left the generated validator requiring old `page.js` paths. `rm -rf .next`
  before the build regenerates it; `npx tsc --noEmit` alone can miss it if the stale file is
  excluded.
- **`rm -rf .next` while the preview server is running destroys that server's own asset
  directory, and every asset then 500s in a way that looks like an application regression.**
  The preview runs `node .next/standalone/server.js` with its cwd *inside* `.next`, so deleting
  `.next` pulls the directory out from under the live process. The HTML still returns 200, but
  `/_next/static/chunks/*.css`, `/_next/static/media/*` and `public/` files all 500 — so the page
  renders unstyled, the listing-card images measure at the wrong aspect ratio (the `aspect-[4/3]`
  box collapses without CSS) and Lighthouse reports `errors-in-console`, `image-aspect-ratio`,
  `image-size-responsive` and a `target-size` failure. A first pass at this concluded the
  marketplace redesign had broken accessibility and image sizing; the fix was to stop the server,
  rebuild, re-copy the assets and restart it. **Before treating a Lighthouse failure on the preview
  as a code defect, assert an asset's status code** (`curl -o /dev/null -w '%{http_code}'
  <origin>/_next/static/chunks/<name>.css`) — a 500 there means the server, not the app. The
  restart sequence is: `kill` the `next-server` PID, `npx next build`, `rm -rf
  .next/standalone/public .next/standalone/.next/static`, `cp -r public .next/standalone/public`,
  `cp -r .next/static .next/standalone/.next/static`, then relaunch `node .next/standalone/server.js`
  with the captured environment (`PORT=12000`, the `NEXT_PUBLIC_*` values and
  `SUPABASE_SERVICE_ROLE_KEY`). Note the server binds the *hostname*, not `127.0.0.1`, so probe it
  by the public URL or the container hostname rather than loopback.
- **A test that asserts "the environment is unconfigured" is not a behaviour test, and it fails in
  any environment that is configured.** `src/lib/store/storage.test.ts` asserted
  `storagePublicUrl(...)` was `null` to prove an ordinary product resolves through Storage rather
  than the bundled-package table. That is only true while `NEXT_PUBLIC_SUPABASE_URL` is unset, so it
  failed in this container (which sets it) with nothing actually wrong. The fix asserts the real
  invariant — `productImageSrc` returns `storagePublicUrl(path)`, and `seededImage` returns `null`
  for a non-package SKU — and moves the unconfigured branch into its own test that mocks
  `@/lib/config/env` with an empty `supabaseUrl` via `vi.doMock` + `vi.resetModules`. It now passes
  with the URL set and with it unset. Do not "fix" such a test by relaxing it to `toBeDefined()`.

### Price sorting is a currency-scoped claim, and the harness had drifted

- **A price filter scoped to one currency does not make the price *sort* scoped.** Migration 64
  added `p_currency` and required the price bound to match it, but `price_asc`/`price_desc` still
  ordered by the raw `price_minor`. A portfolio holding more than one currency was therefore
  ordered by two numbers that mean different things — a XAF 85,000,000 listing sorted above a USD
  300,000 one and read as "cheaper". There is no exchange-rate feed and the brief forbids inventing
  one, so `20260101000069_price_sort_currency_scope.sql` puts a currency-grouping key ahead of the
  price case in the `ORDER BY`. Every matching listing still appears; the ordering simply stops
  making a cross-currency claim. Reproduced on a real database: with two fixtures whose raw
  magnitudes and currency-grouped order differ, the new function returns a different sequence than
  the old one for the same rows.
- **The function is `create or replace`, so the signature — and therefore the Phase 12 browser
  grant that names it — is unchanged.** Do not `drop` and recreate it: the grant names the exact
  argument list, and a changed signature would silently take search off the allow-list (and fail
  `30_function_execute_hardening.sql`'s subset assertion).
- **The assertion lives in the migration, not only in a text test.** The `do $$` block reads
  `pg_get_functiondef` and fails the migration if the currency grouping is absent. Verified as
  load-bearing by installing an ungrouped copy of the function and watching the block raise. A
  Vitest that greps the migration text cannot see a later migration replacing the function without
  the grouping; the database check can.
- **Two validators had drifted behind the schema, and both failed on a fresh database before this
  change.** They are pre-existing, not caused by the currency work, but a red harness makes every
  future verification worthless, so they were fixed here:
  - `30_function_execute_hardening.sql` pinned `search_property_listings`'s signature *without* the
    `p_locality text` argument that migration 64 introduced, so `has_function_privilege` raised
    `function ... does not exist` — and it would have hidden a genuine grant regression behind that
    error.
  - `100_account_capabilities_behaviour.sql` published a listing with only an owner/agent
    authorization on file. Migration 62 pins every non-administrator listing to
    `source = 'owner_submission'`, so publication now also requires an `approved`
    `listing_submissions` row; the validator was updated to record that approval as the
    administrator, which is the workflow the application actually uses.
- **A validator that inserts a fixed `slug` is not re-runnable, and a second run reports a
  misleading error.** `100_…` uses `'p1-validated-listing'`; on an already-populated database the
  insert raises `duplicate key value violates unique constraint "property_listings_slug_key"`,
  which reads like a policy failure and is not. Run each validate script against a **fresh** database
  (apply `00_supabase_shim.sql`, then the migrations in filename order, then the scripts) rather
  than against a database a previous run left behind.
- **The local Postgres harness is available in this container after installing it.** There is no
  Docker socket and no preinstalled server, but `sudo apt-get install postgresql-17
  postgresql-client-17 postgresql-17-postgis-3 postgresql-contrib-17` gives a real PostgreSQL 17.11
  with the four extensions the migrations need (`citext`, `pg_trgm`, `pgcrypto`, `postgis`).
  `initdb` into a scratch directory and start it on `/tmp` with `-k /tmp`; the `postgres` OS user
  cannot read the workspace, so **pipe each migration's bytes through `psql`'s stdin** rather than
  passing `-f <path>`, and strip the `\set`/`\i` meta-command lines before feeding the validate
  scripts. 69 migrations apply cleanly and all 12 validate scripts pass on a fresh database.

### Phase 8 performance audit: the overlay was built for every search

- **`search_property_listings` built its translation overlay for *every* search, including the ones
  that never read it.** The `localized` CTE is `string_agg` over every `content_translations` row for
  `entity_type = 'property_listing'` in the requested locale, grouped by `entity_id` — a full scan
  plus a sort. Only the keyword branch (`loc.value ilike …`) ever reads it, but the planner built it
  unconditionally. Measured with `auto_explain` *inside* the function (a plain `EXPLAIN` cannot see
  through it) on a 6,000-listing portfolio skewed toward Littoral/Centre: that scan was roughly half
  the total time of a location/category/price browse. Migration
  `20260101000070_search_performance.sql` gates the CTE on `cross join params` / `params.q is not
  null`, so it becomes a no-op for a structured browse. On the same data the `content_translations`
  scan goes from ~7 ms (12,000 rows) to `never executed`, and a browse drops from ~30-45 ms to
  ~16-25 ms. **A CTE with no dependency on the query's parameters is still materialised** — that is
  the whole defect; adding the dependency is the fix.
- **Result equivalence was checked, not assumed.** The rewrite is a `create or replace` of the same
  22-argument function, compared against the previous definition over 18 filter combinations
  (locale, keyword, sort, price, bedrooms, size, locality, status, amenities, paging) — identical
  rows and order in every case. **A first pass at this comparison "passed" 13 cases that were
  actually erroring**: passing `p_min_bedrooms=>2` without a cast makes Postgres unable to resolve
  the overload, so both sides returned empty stdout and compared equal. Assert the exit code (or
  hash the output with the error text included) when comparing two function versions, or a missing
  cast reads as a match.
- **Indexes were added only where a plan proved them, and the ones that did not are recorded as
  deliberately absent.** `content_translations_localized_idx` is a covering index
  `(entity_type, locale, field_name) include (entity_id, value)`; it turns the keyword-path overlay
  into an `Index Only Scan` and measured ~65 ms → ~53 ms. Partial indexes on `division_id`,
  `subdivision_id`, `(currency, price_minor)` and `view_count` were each created and measured
  against the real function on the skewed portfolio and changed nothing — the planner kept the
  sequential scan and the timings did not move — so they are not shipped. The geography tables are
  10/58/360 rows, so an index on a listing's geography column cannot pay for itself. A review that
  asks "why is there no index on `division_id`" should read the migration header.
- **`loadListingRegionOptions` downloaded the whole portfolio to count it.** It selected every
  published listing with its joined region and tallied in JS. That reads the entire table on every
  landing-page render, and — the worse half — it silently reports *wrong* numbers once the portfolio
  passes PostgREST's `max-rows` cap, because the response is truncated and the regions past the cut
  vanish from the index. It now counts through `listing_geography_counts()` (the RPC the filter
  already uses, so the count beside a region equals the result set its link leads to) and selects
  only the ten region rows. Counts verified identical to the old JS tally on the 6k portfolio. **This
  is the general trap: any "count by downloading rows" loader is correct only until the table grows
  past the row cap, and then it is quietly wrong rather than slow.**
- **A 500-account / 6,000-listing portfolio is a small dataset, and the honest conclusion is that the
  SQL was already the bottleneck's *shape*, not its indexes.** `N+1` was checked and does not exist:
  `enrich()` batches `loadListingImages` / `loadPublicLocations` / `loadListingTranslations` through
  `Promise.all`, each using `.in()` on the page's ids, and the listings page composes
  `queryListings` / geography / facets / favourites in one `Promise.all`. Do not "optimise" by adding
  indexes to the filter columns without measuring first — on this shape they do not help.

### Sign-up: role and residency are dropdowns

- **The role ("I am signing up as") and residency questions are `<select>`s, not radio groups.**
  Both are single required choices, so collapsing them keeps the form short on a phone. They use the
  shared `SelectField` primitive, which already wires the label, hint and error text and sets
  `required` — do not hand-roll a `<select>` here.
- **The option `value`s are a contract with `signUpSchema`, so the test pins them.** The role options
  are exactly `ACCOUNT_TYPES` (`buyer`/`landlord`/`agent`) and residency is `""`/`"true"`/`"false"`.
  `SignUpForm.test.tsx` asserts the value lists and that no radio controls render, because a
  mismatched option value would submit a string the schema refuses and fail only on POST.
- **The role select is controlled; residency is uncontrolled with a blank initial option.** The
  role drives the date-of-birth hint below it (`requiresAdult`), so it must be controlled to re-render
  that hint. Residency has no dependent field, so it keeps `defaultValue=""`; the blank option is
  `disabled` and is the initial state, which is how "no answer" stays distinct from a fabricated
  `false` — the same distinction `signUpSchema` preserves by normalising a blank to `undefined`.
- **A capability role no longer prints its explanation under a radio; the text moved into the
  option label** (`"Landlord / Property Owner — List and manage property you own…"`). The one-line
  explanations still come from `auth.accountType.<type>.body`, so the copy lives in one place and
  both locales carry it. If the option text is ever truncated on a narrow control, that is a CSS
  concern, not a reason to drop the explanation from the DOM.
- **The `noindex` auth routes score SEO 66 in Lighthouse on purpose** — `is-crawlable` reports
  "blocked from indexing", which is the intended state for `/admin/*`. Best-practices 96 on these
  routes is the pre-existing static-CSP `'unsafe-inline'` flag (identical on the deployed preview
  and on `/admin/login`); accessibility is 100. Do not chase either as a regression from a form
  change.

### Phase 9: design, SEO and accessibility audit of the real-estate marketplace

The marketplace already met the brief on most counts; the audit found and fixed three defects and
confirmed the rest. What was verified rather than changed is recorded here so a later pass does not
redo it.

**Design consistency (no change needed).** No component in `src/components/marketplace/` or
`src/components/real-estate/` hard-codes a colour — every value is a token or the `--dept-accent`
family. The department accent is set once per subtree by `departmentScopeProps("real-estate")` on
both the landing page and the results page, and the Real Estate accent (`#1E5631`) is the
text-safe variant with white text at 8.64:1. Typography is Sora/Inter/JetBrains Mono as elsewhere;
the logo is untouched. **A new marketplace component must take the accent from the token, never a
hex, and must sit under a subtree that sets `data-department`.**

**Accessibility (no change needed).** `Modal` carries `role="dialog"` + `aria-modal` + a labelled
close control, and traps focus, closes on Escape and returns focus to the trigger. The mobile
filter drawer is that same `Modal` with `placement="side"`, and renders the *same* filter form as
the desktop column. `FavoriteButton` is `aria-pressed` with a per-listing label and is a sibling of
the card link, not a descendant, so the whole card can be clickable without swallowing the action.
`MarketplaceFilterSection` is a native `<details>`, so the disclosure works without JavaScript.
`MarketplaceSearchableSelect` implements the ARIA combobox pattern (`role="combobox"`,
`aria-expanded`, `aria-activedescendant`, Home/End/Up/Down/Enter/Escape). Form errors render
through `Alert`, which is `role="alert"` for error tones. Lighthouse accessibility is 100 on every
real-estate surface, unfiltered and filtered.

**SEO (no change needed except the comment fix below).** Canonicals are locale-qualified absolute
URLs; `hreflang` is `en`/`fr`/`x-default` with `x-default` pointing at the gateway; the unfiltered
browser is `index, follow`; a filtered view is `noindex, nofollow, nocache` with the locale
alternates dropped and the canonical kept; listing pages take `noindex` from `entity_seo`; the
sitemap lists published listings with `lastModified` from `record.updatedAt`; `robots.txt` disallows
`/admin/`, `/auth/` and `/api/`. Admin, KYC, the customer account hub and both dashboards are
`noindex`, with the admin layout and the dashboard layout each declaring it once so a new child
route inherits it. KYC data never reaches metadata or structured data.

**Defects fixed in this phase.**

- **A card's fact icons were chosen by array position, not by what the fact is.** `listingFactChips`
  returned a bare `string[]` and the card picked `BedDouble` for index 0, `Bath` for index 1 and
  `Ruler` for the rest. Bedrooms and bathrooms are both optional and independent, so a listing with
  bathrooms but no bedroom count rendered "2 bathrooms" beside a **bed** icon. The function now
  returns `{ kind, label }` and the icon follows `kind`. `ListingCard.test.tsx` pins the
  bathrooms-without-bedrooms case, which is the one that broke.
- **`formatArea` hard-coded `"en-CM"` regardless of locale**, so every French page rendered
  "1,234 m²" where French groups with a narrow no-break space ("1 234 m²"). It now takes the locale
  and picks `fr-CM`/`en-CM`, matching `formatListingPrice`. Both call sites (the card and the detail
  page's fact rows) pass it. **The same trap applies to any new number a French page renders** —
  `Intl.NumberFormat` with a fixed locale is an English-only rendering.
- **Five comments described the filtered view as `noindex, follow`, but the code emits
  `noindex, nofollow`.** `buildMetadata` has set `follow: false` since Phase 1, and
  `seo.test.ts` asserts it; the comments in `search.ts`, `loaders.ts`, the listings page and two
  marketplace components had drifted. The comments now match the behaviour. This was a
  documentation defect only — no crawl directive changed.

**Verified and deliberately left alone.** The landing page's headline already reads "Find the Right
Property in Cameroon" with a location selector, a keyword input, a search button and category
shortcuts, all in one GET form so the search is a URL. The sidebar is 272–288px via grid tracks
(`lg:grid-cols-[17rem_1fr]`), not fixed widths. Price bounds carry the brief's exact wording as
hints and state the currency; there are **no budget presets**, correctly, because none could be
computed from real data. Sorting offers all five options the SQL supports (relevance, newest,
price-asc, price-desc, most-viewed). Multi-image upload already works for products, listings and
both dashboards (`formData.getAll("image")` with a `multiple` file input), and the super-admin
verification badge is written by `setPublisherVerificationAction` through the session client so the
`real_estate_memberships_enforce_verification` trigger is the control.

**A Lighthouse performance number for this page is not trustworthy under default throttling.**
`/en/real-estate` scored 83 with a simulated LCP of 4.4s under Lantern, and 98 with LCP 1.8s under
`--throttling-method=devtools`. This is the third time this repo has hit the Lantern overstatement
on this app; use applied throttling before chasing a simulated-LCP regression.

### Corporate page heroes (`PageHero`) and the scrim's protected column

- **`src/components/ui/PageHero.tsx` is the shared on-ink hero for the corporate pages** (`/about`,
  `/services`, `/gallery`, `/contact`). It renders `HeroMedia` as the backdrop, the decorative grid
  and glows (`aria-hidden`), the breadcrumb trail, a mono eyebrow, the `h1` with the heading rule, the
  lede, optional children (CTAs) and an optional `meta` definition list. The About page and the three
  section pages all use it, so a change to the hero is one file, not four.
- **The hero's `meta` strip must stay inside the copy column (`max-w-3xl`), not span the container.**
  The `.hero-scrim` is weighted to the inline-start edge, so a three-column strip across the full
  width puts its last column over the *lightly* scrimmed right side of the photograph. Measured over
  the bright corporate backdrop, the third column's label fell to **1.4:1** (mean background). It
  now sits in `max-w-3xl`, where every column is inside the protected zone; re-measured worst-case
  mean-background ratio is **5.36:1**, in line with the pre-existing department heroes (5.52:1).
  Anything new that lands under hero copy on the *right* of the band needs the same re-measurement.
- **Measure hero contrast against the mean background, and against the pre-existing heroes as a
  baseline.** The 98th-percentile-pixel standard fails the department heroes the scrim was tuned
  against (min 1.53:1 on `en/electrical-services`), so it is too harsh to be the pass/fail line —
  a single specular pixel is not what a reader experiences. The useful measurement is the mean
  background under each glyph run, compared with the existing heroes; both must clear 4.5:1.
- **The full-page screenshot is a hostile environment for this measurement: fixed overlays land at
  the wrong offset.** The PWA install banner (`aside.fixed inset-x-3 bottom-3`) is painted once in a
  `fullPage` capture and appeared as a white band across the hero, which read as a 1.19:1 contrast
  failure on `dd.mt-2`. Remove `position: fixed` elements before capturing, and prefer a
  `visibility: hidden` per text element over hiding the hero (hiding the section also hides the
  photo, because descendants set their own visibility).
- **An opaque pill's label is measured against the pill, not the photo.** The `a.cta-lift` hero CTAs
  report ~1.0:1 against the backdrop because their own `bg-*` is what the label sits on; exclude them
  from a hero-copy scan or compare each against its own computed background.
- **`chairman-portrait-v2.jpg` is the current portrait, and the filename carries the version on
  purpose.** `next/image` serves optimised images with `max-age=14400`, so replacing a file in place
  leaves the old bytes in caches; ship a new filename and update `PORTRAIT_SRC` and
  `hero-images.test.ts` together. The image is still a development placeholder pending a real
  photograph — do not present it as a photograph of the founder.
- **A new `accentOnInk` button variant exists for filled accent controls on an ink band.** On ink the
  accent resolves to `--dept-accent-bright`, where white text is ~2:1; the variant pairs
  `bg-dept-accent-bright` with `text-ink-950` instead. Use it for any CTA inside `PageHero`'s
  `on-ink` band rather than `variant="accent"`.

- **Each corporate page owns its own backdrop, and the four are declared in one place.**
  `CORPORATE_PAGE_HEROES` in `src/lib/config/site.ts` maps `about | services | gallery | contact` to
  an image, and the pages read it through `corporatePageHero(page)` rather than hardcoding a path.
  Before this, About and Contact shared `corporate-v3.jpg` and Gallery borrowed
  `electrical-services-v2.jpg` (a *department* hero), so three pages opened identically. Services had
  no image at all. `hero-images.test.ts` now asserts the four paths are distinct *and* disjoint from
  every department hero, so a future "just reuse that one" edit fails the suite.
- **A CC BY image obliges attribution, and the obligation is data, not a comment.** Three of the four
  new backdrops are CC BY (3.0/4.0/2.0) and carry a `credit` on their config entry, which `PageHero`
  renders under the meta strip inside the copy column; the About backdrop is CC0 and carries none.
  `hero-images.test.ts` pins the split, so a swap to a CC BY file without a credit fails. This
  discharges the pre-existing debt for the *new* files; the two older CC BY heroes
  (`corporate-v3.jpg`, `digital-marketing-v3.jpg`) still render no credit and are documented as
  pending in "Hero image provenance".
- **The new backdrops were chosen by measured contrast against the real scrim, not by eye.** Each
  candidate was composited with the exact `.hero-scrim` stops at the hero's real geometry and scored
  against the *rendered* text runs (the `Range.getClientRects()` boxes, so a full-width block whose
  text covers a small part of its own box does not dilute the sample). Final worst-case ratios across
  390/768/1024/1440: about 6.06, services 8.53, gallery 7.49, contact 5.79 — all above AA. A bright
  image fails this: a sunny solar-panel shot measured 3.32:1 and was rejected despite being the most
  on-theme candidate, because the copy sits over sunlit panels.
- **The 1024px breakpoint is the binding one, and only a browser finds it.** The first About pick (a
  Mount Cameroon photograph, CC0) measured 4.93:1 at 1440 and looked fine, but **2.66:1 at 1024**:
  between `md` and the `lg` container the copy column is still narrow while the scrim is already the
  desktop gradient, so the bright sky band lands directly under the copy. Measured against the live
  pages, the shipped department heroes all clear 5.5:1 at 1024, so this was a new-image problem, not a
  scrim problem. Always measure 1024, not just 1440 and mobile.
- **Prefer CC0/public-domain so no new attribution debt is created, and check the licence per file.**
  Candidates were gathered through the Wikimedia Commons API (`list=search` +
  `prop=imageinfo&iiprop=extmetadata`), which returns `LicenseShortName`, `Artist` and `Credit` — read
  those rather than trusting a filename or a search snippet. The About backdrop was swapped a second
  time to reach a passing contrast *and* stay CC0 (an aerial view of Bafoussam), because the CC0
  Cameroon images that passed were otherwise mountain/forest scenes rather than the company's own
  built environment.
- **Replacing a hero file in place does not change the measurement, because the URL is unchanged.**
  Overwriting `about-v1.jpg` with a darker image left the 1024px ratio at exactly 2.66:1 — Next's
  optimizer had cached the old bytes under the same `/_next/image?url=…` key (`max-age=14400`), so the
  page still served the bright sky. The fix is a **new filename** (`about-v2.jpg`); the same trap is
  documented for the department heroes. After the rename the ratio moved to 6.06:1, and the two
  numbers being identical beforehand is what identifies a stale-asset problem rather than a bad image.

### CSP blocked the map entirely, and nothing in the page said so

- **`connect-src` did not include the tile origin, so `?view=map` could never
  render on any deployment.** `PropertyMap` fetches its MapLibre style from
  `https://tiles.openfreemap.org`, CSP refused the request, MapLibre never fired
  `load`, the component's 12s timeout set `unavailable`, and the page printed
  "The map could not be loaded. The list below shows the same properties." The
  list is genuinely fine, which is why it read as an empty inventory rather than
  a blocked request. `buildContentSecurityPolicy` now always includes a map
  origin (overridable via `mapTileOrigin`, which `next.config.ts` derives from
  `NEXT_PUBLIC_MAP_PROVIDER` so switching to Mapbox cannot leave CSP pointing at
  OpenFreeMap).
- **The failure is invisible to every check that does not execute JavaScript.**
  The markup contains the canvas, the attribution element and the fallback label
  in both the working and broken states, so `curl` and any DOM assertion see no
  difference. It was found by reading the browser's rendered text and noticing
  the fallback sentence *and* "0 properties with a location" together — then
  confirming the `connect-src` header. Verify a map fix by checking the
  attribution links (`OpenFreeMap`, `© OpenMapTiles`, `OpenStreetMap`) appear,
  which only happens after a successful style load, and by sampling the map
  region's pixels for colour variety rather than expecting a mostly-flat fill.
- **MapLibre spawns its worker from a blob URL, so `worker-src` needs `blob:`.**
  It was `'self'` for the service worker alone. Both are stated explicitly now.
- **`listing_locations_api` returns nothing when `public_listing_locations` is
  empty, and the map is then honest about it.** The preview database's listings
  carry no coordinates (`listing_private_details.exact_location` is null), so
  "0 properties with a location" was correct, not a second bug. A listing only
  gets a marker once its private coordinate is set through
  `set_listing_private_details`; the coarsened public position is derived from
  it.

### The marketplace results grid had no LCP candidate

- **Twelve listing cards meant twelve `next/image` tags with no `priority`, so the
  browser had no idea which photograph was the LCP element.** Lighthouse's
  `lcp-discovery-insight` reported `priorityHinted: false`, and the LCP sat at
  2.4-2.6s on the results page while a content-only page (`/en/terms`) measured
  98. `ListingCard` now takes `priority` and `ListingGrid` takes `priorityCount`,
  which the results page sets to 2 (the first row at `sm`; the third card joins
  it at `xl`, and the two-card default is the conservative choice because an
  over-prioritised image competes with the real LCP).
- **A prioritised `next/image` emits a `<link rel="preload" as="image">`, and that
  link carries `fetchpriority="high"` only if `fetchPriority` is passed
  explicitly.** `priority` on its own drops `loading="lazy"` but leaves the
  request at default priority, so `lcp-discovery-insight` still reports
  `priorityHinted: false` and the fix appears not to have worked. `ListingCard`
  therefore passes both. Grepping the HTML for `fetchpriority="high"` on the
  `<img>` finds nothing either way — check the preload `<link>`s, and assert on
  `loading` / `fetchpriority` in a component test.
- **`publicEnv` is evaluated once at import time, so a test cannot set
  `NEXT_PUBLIC_SUPABASE_URL` late to make `propertyMediaPublicUrl` return a URL.**
  A card fixture with `images: [...]` still rendered the no-photograph
  placeholder, because the helper returned `null`. `ListingCard.test.tsx` mocks
  `@/lib/real-estate/storage` instead, keeping the real module for everything
  else via `importActual`.
- **Measured effect: LCP 2.4-2.6s to 1.9s, `priorityHinted` true, performance
  86-91 to 89-93 desktop.** TBT (270-400ms) is now the largest remaining cost and
  comes from hydrating the filter sidebar, the drawer, twelve save controls and
  the toolbar, not from the images. Do not expect the priority fix alone to reach
  100; accessibility, best-practices and SEO are 100 on desktop and mobile, and
  performance on a 4-core container varies by about 5 points run to run.
- **The map view scores about 73 and that is MapLibre, not the page.** Its chunk
  costs 2.7s of bootup on the same container, against 1.6s for the results page
  itself. The map is a deliberate opt-in view, the library is dynamically
  imported so a list visitor never downloads it, and the list remains the
  accessible path to every listing.

### Phase 10 testing gotchas worth not rediscovering

- **A documented "optional" field can still be required.** `kycApplicationSchema.idNumberLast4`
  was commented "Optional" but was a bare `z.string()...regex(...).or(z.literal(""))` with no
  `.optional()`, so an omitted key failed validation. It was masked because the form action always
  coerces the value to `""`; only a test that calls the schema without the key exposed it. The
  `.or(z.literal(""))` accepts an empty string but not `undefined`, and those are different
  contracts. When a comment claims "optional", assert it with a parse that omits the key.
- **Zod v4's `z.string().uuid()` enforces RFC 4122 version and variant bits, not just the
  `8-4-4-4-12` shape.** A fixture like `11111111-1111-1111-1111-111111111111` is refused with
  "Invalid UUID" even though it looks like one, so every form-validation test using it fails at the
  schema step. Use a real v4 UUID (`11111111-1111-4111-8111-111111111111`) in fixtures.
- **jsdom's `File` has no `arrayBuffer()`, which a Server Action that reads uploaded bytes calls.**
  A plain object breaks `instanceof File`; instead build a real `File` and attach the method with
  `Object.defineProperty`. Copy the bytes into a fresh `ArrayBuffer` before `new File([buffer], …)`,
  or TypeScript rejects the `Uint8Array` as a `BlobPart` (`ArrayBufferLike` is not `ArrayBuffer`).
- **A standalone-bundle server whose `cwd` is a `(deleted)` directory serves 500 for every static
  asset.** A later `npm run build` replaces `.next/standalone`, and the already-running
  `next-server` keeps its old, now-unlinked working directory: HTML still returns 200 but
  `/_next/static/chunks/*.css`, fonts, `public/` files and `/icons/*.png` all 500, and `next/image`
  answers 400. The symptom looks like a broken build or a contrast/styling defect. Check
  `ls -l /proc/<pid>/cwd` for `(deleted)`, then rebuild, re-copy `public` and `.next/static` into
  `.next/standalone` (the `rm -rf` + `cp -r` dance from the earlier gotcha), and restart. The CSS
  returning 500 while the file exists on disk is the tell.
- **The KYC badge and publisher-verification boundaries are proven in `supabase/validate/`, not in
  Vitest.** `120_publisher_verification_behaviour.sql` shows an approved-but-unverified publisher is
  NOT verified, that a real-estate administrator is refused the grant (`42501`) while a super admin
  is accepted, and that the denormalized `publisher_verified` flag follows a grant, a revocation and
  a suspension onto every listing the poster holds. A `SECURITY DEFINER` trigger is invisible to
  TypeScript, so a `.test.ts` can only pin the source's shape — the behavioural proof belongs in the
  harness.
- **`real_estate_memberships_suspension_requires_reason` needs `suspended_at` *and* a non-blank
  `suspension_reason`.** A validation fixture that sets only `status = 'suspended'` and a reason is
  refused; set `suspended_at = now()` too.

### Account deletion (customer self-service and super-admin)

- **Deleting an account is two different operations, and only one of them is SQL.** Removing the
  `auth.users` row is the Supabase Admin API's job (`auth.admin.deleteUser`) because the `auth`
  schema is not ours to write; the migration owns the *content* consequences and the storage paths.
  `20260101000073_account_deletion.sql` adds `detach_and_archive_user_content(uuid)`, which archives
  the listings the account owns, removes its `agent_profiles` row, refuses the last active super
  administrator, and **returns** the storage objects that must be purged.
- **The order of operations is forced, not stylistic.** `property_listings.owner_id` is
  `on delete set null` and the KYC tables cascade, so once the auth row is gone there is no longer
  any way to find the listings to archive or the paths to purge. The paths are therefore read
  *before* the deletion and the objects removed *after* it. `account-deletion-service.ts` is the one
  implementation both entry points call, so the two cannot drift.
- **`pending_review → archived` is not a legal transition, so the archive must step through
  `draft`.** `listing_status_transition_allowed` admits `pending_review → draft` and
  `draft → archived` but not the direct jump, so a naive `set status = 'archived'` raises from
  `enforce_listing_lifecycle` for exactly the listings most likely to exist (a landlord mid-review).
  The function steps a `pending_review` row back to `draft` first.
- **`closed_at` is maintained by the trigger, not by the writer.** `property_listings_closed_requires_at`
  requires it for `sold`/`rented`/`archived`, and `enforce_listing_lifecycle` sets it. That is why
  `archive_listing` does not set it and neither does the deletion function — do not add it, or two
  places will be deciding the same timestamp.
- **An agent record survives an account deletion unless it is removed explicitly.**
  `agent_profiles.user_id` is `on delete set null`, not cascade, so the row would outlive the account
  as a ghost the public agent policy still exposes. The cleanup deletes it; listings that pointed at
  it have `agent_id` nulled by the existing FK.
- **The last-super-admin guard counts *active* super admins.** An inactive one cannot sign in to
  restore the role, so counting them would let the guard be defeated. It is a lockout guard, not a
  privilege one, and it lives in the SQL rather than only in the Server Action — the action's
  self-deletion refusal is the same rule stated earlier and with a better message.
- **A `on delete set null` column is how the business records survive, and that is deliberate.**
  Orders, inquiries and audit rows are kept and detached: an order is a business record that must
  survive the customer, and an audit trail that vanished with its actor would be worthless. The
  deletion does not delete the books.
- **The self-service action takes the account id from the session, never from the form.** A
  `profileId` field on the customer's delete form would be an unauthenticated request to delete an
  arbitrary account; `account-deletion-actions.test.ts` asserts a posted `profileId` is ignored and
  the session id is used.
- **An audit row written *after* the deletion cannot name the deleted user as its actor.**
  `audit_logs.actor_id` is a foreign key to `auth.users`, so inserting the just-deleted id fails the
  constraint — and because `recordAudit` returns a boolean that the caller ignores, the row is
  dropped in silence and the trail this change exists to leave is missing. `on delete set null` does
  not help: it rewrites rows that already existed, it cannot rescue an insert that names a gone user.
  The self-deletion path therefore writes `actorId: null` and carries `deletedUserId` in the
  metadata. The admin path is unaffected — its actor is the surviving super admin — and that
  asymmetry is the point. `account-deletion-actions.test.ts` asserts the null actor, and the test
  was confirmed to fail when the id is put back.
- **A `boolean`-returning audit helper makes a failed write invisible.** `recordAudit` resolves
  `false` on any insert error and no caller checks it, so a constraint violation is
  indistinguishable from success. When a new audit write matters, assert the *arguments* in a test
  and reason about the FK/constraint the row must satisfy, rather than trusting that a call was
  made.
- **`?reason=deleted` reuses the sign-in form's existing notice slot** rather than adding a second
  acknowledgement mechanism, and the success path `redirect()`s instead of returning state — the
  session is gone, so leaving the user on the account page would render a page whose data just
  disappeared. `SignInForm` maps `deleted` to `auth.accountDeleted`.
- **A validation fixture that inserts listings must clean up its translation rows first.**
  `sync_listing_translation_index` writes `translation_entries` / `content_translations` /
  `translation_sync_jobs` with no FK to `property_listings`, so deleting the listing cascades
  nothing and strands a durable queue of Tolgee work for rows that no longer exist. Delete the
  entries and translations *before* the listing (afterwards the `entity_id in (select …)` subquery
  matches nothing).
- **The fixture's `orders` row needs `idempotency_key` and `access_token`** (both `not null`, with
  length/format checks) and its reference must match `^KC-ORD-[0-9]{8}-[A-Z0-9]{6}$`. The `inquiries`
  reference format is different: `^KC-[0-9]{8}-[A-Z0-9]{6}$`.
- **The shim reads `request.jwt.claim.sub` (singular), not the plural JSON `request.jwt.claims`.**
  Setting the plural form leaves `auth.uid()` null, which silently turns a "non-admin is refused"
  assertion into a trusted-context pass. Use `set_config('request.jwt.claim.sub', …, true)`.
- **`kyc_id_type` members are `national_id_card` / `international_passport` / `other_government_id`.**
  A fixture written as `'national_id'` fails the enum at insert.
- **Test the internal role guard separately from the EXECUTE grant.** The revoke makes the function
  unreachable by a browser key, which would mask a missing `is_super_admin()` check inside it. The
  validate script therefore calls it as `service_role` with a non-admin JWT subject, which is exactly
  the shape of a Server Action that forgets to check the role.
- **A Docker socket or a `psql` is not guaranteed in this container, and `pgserver` has no wheel for
  it.** Verify a new migration by reading it and by the `*.test.ts` shape assertions; note in the
  report that the `supabase/validate/*.sql` scripts were not replayed.

### Store cart gotchas worth not rediscovering

- **`npm run build` deletes `.next/standalone` wholesale, including any `.env` you copied into it.**
  The standalone bundle is regenerated from scratch, so `cp .env.local .next/standalone/.env` must be
  repeated after every build, before restarting `server.js`. The symptom is the previous session's
  bug coming back: without `SUPABASE_SERVICE_ROLE_KEY` the cart action returns `unconfigured` and
  every "Add to cart" fails, on a build whose code is correct. Re-copy the env, then restart — do not
  go looking for a code regression.
- **A `"use server"` module may only export async functions, so a shared error mapper lives beside
  it, not in it.** `src/lib/store/cart-error-messages.ts` has no directive and is imported by both
  `AddToCartButton` and `PackageCartControls`; putting `cartErrorMessage` in `cart-actions.ts` would
  fail the production build with "Server Actions must be async functions" while passing `tsc` and
  every unit test. Same rule as `normalizeSearchQuery` in `search.ts`.
- **Mapping every cart failure to one generic sentence is a lie for the faults retrying cannot fix.**
  `unconfigured` (no service-role key), `no_cart` (cookie gone) and `unavailable` are all permanent
  for that click, so "please try again" sends the visitor into a loop that can never succeed. The
  mapper gives each code its own honest message and reserves retry advice for the unknown case.
  `cart-error-messages.test.ts` asserts `unconfigured` does NOT contain "try again".
- **A grid item defaults to `min-width: auto`, so a long unbreakable child forces the track wider
  than the container.** The cart's two-column grid had `min-w-0` on the results column but not on the
  `aside`; the summary's min-content (315px) exceeded the 280px content box at a 320px viewport and
  produced 15px of horizontal page scroll. Both columns need `min-w-0` whenever either contains text
  that can refuse to wrap. Measure `document.documentElement.scrollWidth - window.innerWidth` at 320,
  390, 768, 1024 and 1440 — a single desktop check passes while the phone overflows.
- **`h-9 w-9` is a 36px target and reads as fine on desktop.** The quantity stepper and the remove
  control were 28-36px tall; the touch guideline is 44px. They are now `h-11 w-11`. `CartLines.test.tsx`
  asserts the classes, because jsdom does not lay out so a computed-size assertion would pass
  vacuously.
- **The cart route is deliberately `noindex`, so Lighthouse SEO reports 66 with exactly one failing
  audit: `is-crawlable`.** That is the correct state for a private per-visitor page, not a
  regression — do not "fix" it by removing the `noindex`. Audit a public page (product, store index,
  listings) when you need an SEO score that means something.
- **A product description is plain text, so a contents list renders as one dense paragraph unless
  the renderer recognises bullets.** `descriptionBlocks` (`src/lib/store/description.ts`) splits
  blank-line paragraphs and consecutive `-`/`*`/`•` runs into `<ul>`s; it never interprets HTML, so a
  `<script>` in a description stays visible characters.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
