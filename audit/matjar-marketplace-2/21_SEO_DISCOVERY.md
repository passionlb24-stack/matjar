# 21 — SEO & Discovery

Checkpoint-0 audit. Read-only. Source files read in full; production counts from
`wesihatopiznatsyfxer` on 2026-08-17. One live fetch of `https://matjarlb.com/`
was made to resolve a question the repo could not answer (§2.1).

---

## 1. What exists today

### 1.1 Sitemap — `src/app/sitemap.ts`

Dynamically generated at request time. Emits, **per locale** (`ar`, `en`):

| Block | Source | Count today | Sitemap URLs |
|---|---|---|---|
| Static paths | `STATIC_PATHS` (`sitemap.ts:8-32`) | 22 | 44 |
| Category pages | `categoryKeys` (`catalog.ts:4`) | 17 | 34 |
| Stores | `stores` active, non-deleted; vanity `/{slug}` when present, else `/store/{id}` (`sitemap.ts:103-110`) | 13 (11 with slug) | 26 |
| Products | active + available + non-deleted | 59 | 118 |
| Market listings | `listings` active | 6 | 12 |
| Jobs | `job_postings` active | 2 | 4 |
| Gigs | `gigs` active | 3 | 6 |
| Wholesale | `wholesale_products` active | 0 | 0 |
| Custom pages | `site_pages` published | 0 | 0 |
| Academy guides | `getAcademyGuides()` | 8 | 16 |
| Business leaders | `business_leaders` published | 120 | 240 |
| **Total** | | | **≈500** |

Two things fall out of that table immediately:

- **48% of the sitemap is `business_leaders`** — an editorial dataset seeded by
  migrations `0140`/`0141`, not marketplace inventory. The largest indexable
  surface on Matjar is a directory of people, not shops.
- **24 of the 34 category URLs render an empty grid**, because 12 of the 17
  sectors have zero merchants (see `08_VERTICAL_SEARCH.md` §0). Matjar is
  already submitting thin pages to Google, today, before anyone adds a single
  location page.

Defects in the sitemap itself:

- No `.limit()` on the `stores`/`products` queries (`sitemap.ts:71-88`). PostgREST
  caps at 1000 rows by default, so the sitemap will **silently truncate** at
  1000 products with no error. Needs pagination or a `sitemap.xml` index before
  the catalogue grows.
- No `alternates.languages` on any entry. Next's `MetadataRoute.Sitemap`
  supports `xhtml:link` alternates; the file instead emits the `ar` and `en`
  URLs as two unrelated entries. Google can still find the hreflang in the page
  `<head>`, so this is a "should", not a "must".
- `changeFrequency` and `priority` are set throughout. Google has stated it
  ignores both. Harmless, but they are not doing anything.
- `/crafts`, `/crafts/[trade]`, `/best-sellers` … — `/crafts` is **absent from
  `STATIC_PATHS`** and none of the 47 trade pages are emitted. See §2.3.

### 1.2 robots — `src/app/robots.ts`

- Blocks eight resource-hungry crawlers outright (`AhrefsBot`, `SemrushBot`,
  `MJ12bot`, `DotBot`, `PetalBot`, `Bytespider`, `DataForSeoBot`, `BLEXBot`)
  with a stated reason: serverless CPU with no traffic in return. Reasonable.
- `User-agent: *` allows `/` and disallows the private surfaces per locale:
  `/merchant`, `/admin`, `/account`, `/orders`, `/bookings`, `/messages`,
  `/notifications`, `/wishlist`, `/favorites`, `/following`, `/track`,
  **`/search`**.
- Points at `${SITE_URL}/sitemap.xml`.

Verified that each disallowed path maps to a real route: `(dashboard)/merchant`,
`(dashboard)/admin`, and the `(site)` routes all exist. This list is accurate,
which is rarer than it sounds.

One inconsistency: the homepage emits a `WebSite` `SearchAction` whose
`urlTemplate` is `${siteUrl}/${lang}/search?q={search_term_string}`
(`src/lib/jsonld.ts:223`) — pointing at the one path robots disallows. Not
harmful (the sitelinks search box does not require crawling the target), but it
is a contradiction someone will "fix" in the wrong direction later.

### 1.3 Metadata

- `metadataBase` set from `SITE_URL` at `src/app/[lang]/layout.tsx:33`.
  `SITE_URL` defaults to `https://matjarlb.com` and is overridable by
  `NEXT_PUBLIC_SITE_URL` (`src/lib/site.ts:3`).
- Title template `%s · متجر`, default `متجر | Matjar`, bilingual site
  description, OG `website` + 1200×630 `opengraph-image.png`, Twitter
  `summary_large_image`, `manifest`, and a Google Search Console verification
  token (`layout.tsx:55`). A second verification file exists at
  `public/googlefe3d550813c09b12.html`.
- `<html lang>` and `<html dir>` set correctly per locale (`layout.tsx:83-84`,
  `localeDirection` from `src/i18n/config.ts`).
- **40 of 141 page files define `generateMetadata`.** 31 call
  `localeAlternates()`.

`localeAlternates(lang, path)` (`src/lib/site.ts:10`) returns
`canonical: /{lang}{path}` plus `languages: { ar, en, "x-default": /ar{path} }`.
The shape is right, `x-default → ar` is the correct call for a Lebanon-first
marketplace, and Next resolves the relative values against `metadataBase`.

### 1.4 Structured data — `src/lib/jsonld.ts`

Genuinely good for a platform this young:

| Type | Where | Notes |
|---|---|---|
| `Organization` + `WebSite`/`SearchAction` | homepage, `[lang]/(site)/page.tsx:77` | |
| `LocalBusiness` | store page, `store/[id]/page.tsx:517` | address, geo, telephone, priceRange, `openingHoursSpecification` via `toOpeningHours`, `aggregateRating` |
| `Product` + `Offer` | `product/[id]/page.tsx:226` | price, `InStock`/`OutOfStock`, brand, aggregateRating |
| `JobPosting` | `jobs/[id]/page.tsx:128` | employmentType mapping, `TELECOMMUTE` for remote, `jobLocation` |
| `FAQPage` | `help/page.tsx:50` | |
| `BreadcrumbList` | `components/breadcrumbs.tsx:25` | |

`jsonLdScript()` (`jsonld.ts:235`) escapes `<`, `>`, `&` to `\uXXXX` before
injection — correct, and necessary because store names are merchant-controlled.
Unit tests exist (`src/lib/__tests__/jsonld.test.ts`). The `JobPosting` builder
deliberately omits `baseSalary` because `salary_note` is free text — the comment
explains that a malformed salary hurts eligibility more than omitting it. That
is the right instinct and it should govern the rest of this document.

Missing: no `ItemList` / `CollectionPage` on `/explore`, `/category/[slug]`, or
`/crafts/[trade]`; no `Service` on service items; no `LodgingBusiness` for
hospitality; no `MedicalBusiness` for healthcare.

---

## 2. Defects found, ranked

### 2.1 The bare domain is served by configuration that is not in the repo

There is **no `src/app/page.tsx`, no `src/middleware.ts`, no `redirects()` in
`next.config.ts`, and no `rewrites` in `vercel.json`** (which contains only
`{"regions":["fra1"]}`). On the code alone, `https://matjarlb.com/` should 404,
because `app/[lang]` cannot match a zero-segment path.

I fetched it. It serves the Arabic homepage. So a redirect or rewrite exists at
the platform level, configured in the Vercel dashboard.

That is not currently broken, but it is **untracked in version control,
invisible to code review, and lost on a platform migration**. It is also the
mechanism that decides whether `/` and `/ar` are one page or two. Move it into
`next.config.ts` as an explicit `redirect` from `/` to `/ar` (308) so it is
reviewable and so the duplicate-content question has a checked-in answer.

### 2.2 Every storefront is reachable at two self-canonical URLs

- `src/components/store-card.tsx:138` links to **`/${lang}/store/${store.id}`**
  — the UUID URL. This is the card used on the homepage, `/explore`,
  `/category/[slug]` and `/search`. **All internal links point at the UUID.**
- `src/app/sitemap.ts:103-110` emits **`/${lang}/${slug}`** when a slug exists.
  **The sitemap points at the vanity URL.**
- `store/[id]/page.tsx:124` sets `canonical: /{lang}/store/{id}` — self.
- `[handle]/page.tsx:44` sets `canonical: /{lang}/{handle}` — also self.

So for the **11 active stores that have a slug**, there are two indexable URLs
serving byte-identical content, each declaring itself canonical, with internal
PageRank flowing to one and the sitemap endorsing the other. This is a textbook
duplicate-content split, and it is live now.

**Fix:** make `store/[id]` canonical to the vanity URL when a slug exists, and
point `StoreCard` at the slug. Two small edits; both are one-way doors if left
until the URLs have acquired links.

### 2.3 47 empty trade pages, unlisted and uncanonicalised

`/[lang]/crafts/[trade]` exists and is a well-built landing page — its own
comment (line 43) says "someone searching 'كهربائي طرابلس' is not browsing, they
have a problem right now." With 47 active `trades` × 2 locales that is **94
live URLs**.

`craft_providers` has **0 rows**. Every one of those 94 pages renders an empty
state. And:

- `/crafts` is not in `STATIC_PATHS`, and no trade page is emitted by the
  sitemap.
- `crafts/[trade]/page.tsx:36-40` returns `{ title, description }` with **no
  `alternates`** — so no canonical and no hreflang on any of the 94. Same for
  `crafts/page.tsx`.

This is precisely the thin-page failure mode the brief warns about, already
shipped, at 94 URLs. The correct action today is `robots: { index: false }` on
`crafts/[trade]` until a trade has providers, plus the missing `alternates`.
Then flip pages to indexable per-trade as providers arrive — which is the exact
threshold logic §3 recommends for location pages, so build it once.

### 2.4 Filtered views have no URL

Covered in `09_VERTICAL_FILTERS.md` §1.1: `/explore` reads `q`/`region`/`group`
from `searchParams` once and never writes state back. There is therefore no such
thing as "the North × Shopping page" — it cannot be linked to, cannot appear in
a sitemap, cannot be canonicalised, cannot rank. **Any location-or-facet SEO
strategy is blocked behind this one fix.** `/market` already does it correctly
(`market/page.tsx:46-52`, server-side, URL-driven); copy that.

### 2.5 Pages with no `alternates` at all

Of the `(site)` routes with `generateMetadata`, these set title/description but
no canonical or hreflang: `crafts/page.tsx`, `crafts/[trade]/page.tsx`,
`search/page.tsx` (disallowed anyway, so acceptable). Routes with **no**
`generateMetadata` at all inherit only the layout defaults — including
`/market`, `/offers`, `/best-sellers`, `/clearance`, `/map`, `/best-sellers`,
`/store` sub-pages — so they get the default title `متجر | Matjar` and no
canonical. Several of these *are* in `STATIC_PATHS` and are therefore submitted
to Google with a generic title and no per-page description.

### 2.6 `store_visits` cannot answer "did SEO work"

`track_store_visit` buckets the referrer into `google | instagram | facebook |
whatsapp | tiktok | twitter | internal | direct | other` (`0216:132-147`) and
169 rows exist. That is the only organic-traffic signal on the platform. It
records the *store* page but not the *category* or *landing* pages, so it cannot
attribute a location/sector page to an outcome. See `20_ANALYTICS_FUNNEL.md`.

---

## 3. The proposed `/{location}/{sector}` architecture, assessed honestly

### 3.1 The location dimension does not exist as data

This is the finding that decides the whole section.

- `stores.region` — 5 possible values. **All 13 active stores are `north`.** One
  populated value.
- `stores.area` — **free text**. Twelve distinct values across thirteen stores,
  and they are directions, not places: `"طرابلس عزمي بجانب مستشفى الاسلامي"`,
  `"الضنية مراح السراج مقابل الطريق العام"`, `"Tripoli"`. Three stores have no
  area at all. **There is no join key.** You cannot `GROUP BY` this column, so
  you cannot generate a page per area from it.
- `lb_areas` — a *proper* controlled vocabulary of 45 Lebanese areas with slugs
  and bilingual names (`0235:53`). It is the right table. **Nothing links a
  store to it.** The `store_service_areas` join table from `0235` was dropped in
  `0240` when craft providers moved off `stores`.
- `store_locations` (33 rows, `0084`) has its own free-text `area` too.

So `/{location}/{sector}` currently has 1 usable location × 5 populated sectors,
and the location is "the whole north of Lebanon".

**Prerequisite, unavoidable:** `stores.area_id uuid references lb_areas(id)`,
plus a required picker in the store form. This is also the top recommendation in
`09_VERTICAL_FILTERS.md` §3. Thirteen stores can be backfilled by hand this
week. At 500 stores it becomes a project nobody funds.

### 3.2 The combinatorics, spelled out

45 areas × 17 sectors × 2 locales = **1,530 URLs**. Add region-level pages
(5 × 17 × 2 = 170) and you are at **1,700**.

Live inventory to fill them: **13 merchants, 59 products, all in one region.**

That is roughly **130 pages per merchant**. Google's documented guidance on
doorway pages and its treatment of "thin affiliate/aggregator" content both bite
here, and the practical outcome is worse than "those pages don't rank": a site
where >95% of submitted URLs are empty invites sitewide quality demotion, which
costs you the store and product pages that *do* deserve to rank.

### 3.3 A concrete threshold

A `/{location}/{sector}` page should exist — meaning render at 200 and be
indexable and appear in the sitemap — only when **all** of these hold, evaluated
live, not hard-coded:

| Criterion | Threshold | Why this number |
|---|---|---|
| Distinct active merchants in (location, sector) | **≥ 5** | Below five the page is a list a human would call "nothing here", and one merchant closing empties it. Five is also roughly where a user perceives choice. |
| Total visible offerings across those merchants | **≥ 15** | Three each. A page with five merchants and one product between them is still thin. |
| Merchants with a photo (`logo_url` or `cover_url`) | **≥ 3** | A grid of grey placeholders reads as abandoned regardless of count. |
| Content unique to this page beyond the grid | **≥ 1 paragraph** | Not boilerplate with the place name substituted. If nobody will write it, the page should not exist. |

Below the threshold, three tiers:

- **3–4 merchants**: render the page (users arriving from internal links deserve
  it) but emit `robots: { index: false, follow: true }` and keep it out of the
  sitemap. Re-evaluate on every build.
- **1–2 merchants**: no dedicated page. Redirect (307) to the parent
  region×sector page, or to the sector page with the location pre-filtered.
- **0 merchants**: 404. Not a soft-404 with "no results found" — an actual 404.
  A soft-404 at scale is the single fastest way to acquire a sitewide quality
  problem.

**Applying this to production today, the answer is: zero location×sector pages
qualify.** North × retail is the closest — 7 merchants, 30 products — and it
would clear the merchant and offering bars, but "north" is a third of the
country, not a location a person searches for. Once `area_id` exists and Tripoli
is separable, `tripoli × retail` is plausibly the **first and only** page that
should be built. One page. Written by hand, not generated.

That is the honest recommendation: **build one location page manually, see if it
ranks and converts, and only then write the generator.** The generator is two
days of work at any point; the 1,700 thin pages it produces are a year of
recovery.

### 3.4 What to do instead, now

The pages that deserve investment at 13 merchants are the ones with real content
behind them, and they already exist:

1. **Store pages** — 11 with vanity slugs, `LocalBusiness` JSON-LD, hours, geo,
   ratings. Fix §2.2 and these are genuinely competitive for
   `"<store name> طرابلس"`.
2. **Product pages** — 59, with `Product`/`Offer` markup.
3. **The five populated category pages** — give them unique intro copy, a real
   description, and `ItemList` markup. Set `noindex` on the twelve empty ones
   until they have merchants. This *reduces* the indexed surface, which is the
   correct direction at this inventory.
4. **`/hub/academy` guides (8) and `/hub/leaders` (120)** — already 48% of the
   sitemap. This is editorial content that can rank without merchants and is the
   only lever that works while inventory is thin. It is also the one place where
   more pages is not automatically worse — but 120 leader profiles should be
   audited for uniqueness before being called an asset.

---

## 4. Arabic / English and the `[lang]` routing

### 4.1 What is correct

- Two locales, `ar` default (`i18n/config.ts:7`), both statically generated at
  the layout (`layout.tsx:67`).
- `<html lang>` and `dir` per locale — `rtl` for Arabic. Verified.
- `localeAlternates` emits reciprocal `ar`/`en` plus `x-default: /ar`. Reciprocity
  is the requirement Google actually enforces and this shape satisfies it — for
  the 31 pages that call it.
- Content is genuinely bilingual at the data layer: `products.name_en`,
  `description_en` (`0099_bilingual_products.sql`), `trades.name_ar`/`name_en`,
  `lb_areas.name_ar`/`name_en`, `site_pages.title_en`. This is real localisation,
  not a machine-translated shell.

### 4.2 Problems

1. **Untranslated content served under `/en`.** `stores.name` is a single column
   used for both locales (`stores.ts:44`: `name: { ar: row.name, en: row.name }`).
   `stores.description` and `stores.area` likewise have no English variant. So
   `/en/{store}` is an English chrome around Arabic content. For 59 products,
   `name_en` is optional and mostly unset. **Two near-duplicate pages differing
   only in navigation labels** is a weak hreflang pair; Google may fold them.
   This is not a reason to drop English — it is a reason to require `name_en` on
   the merchant form for any store that wants the `/en` page indexed, or to
   `noindex` `/en` for stores with no English content.
2. **`x-default` points at `/ar`.** Correct for a Lebanese marketplace, but it
   means an English-language searcher's first impression is Arabic. Given Lebanon's
   heavy French/English usage this is worth measuring — which requires analytics
   that do not exist (`20_ANALYTICS_FUNNEL.md`).
3. **The 94 crafts URLs have no hreflang** (§2.3), so `ar`/`en` trade pages
   compete with each other.
4. **No locale detection or `Accept-Language` handling** anywhere — no
   middleware exists. Whatever redirects `/` sends everyone to Arabic. That is a
   defensible product decision; it should be a checked-in one (§2.1).
5. **Arabic URL slugs.** `stores.slug` is constrained to `[a-z0-9-]`
   (`[handle]/page.tsx:17`, migration `0115`), so every vanity URL is
   Latin-script even for Arabic-named shops. Given that Arabic-script URLs are
   percent-encoded into unreadability when shared, Latin slugs are the right
   call — but it means the Arabic store name never appears in the URL, and the
   `<h1>` plus `LocalBusiness.name` are carrying that signal alone. Acceptable;
   worth knowing.

---

## 5. Priority list

**P0 — fixes to live defects, all small**

1. Canonicalise storefronts to one URL and point `StoreCard` at it (§2.2).
2. `noindex` the 94 crafts trade pages until they have providers; add
   `alternates` to them (§2.3).
3. `noindex` the 12 empty category pages; remove them from the sitemap (§1.1).
4. Move the `/` → `/ar` redirect into `next.config.ts` (§2.1).

**P1 — unblocks everything else**

5. Push `/explore` filters into the URL, server-side (§2.4).
6. Add `stores.area_id → lb_areas` and backfill 13 rows by hand (§3.1).
7. Add `generateMetadata` with `localeAlternates` to the `STATIC_PATHS` routes
   that lack it (§2.5).

**P2 — worth doing, not urgent**

8. `ItemList` JSON-LD + unique intro copy on the five populated category pages.
9. Sitemap pagination before 1000 products (§1.1).
10. Require `name_en` for `/en` indexability (§4.2.1).

**Explicitly not now**

11. Do **not** generate `/{location}/{sector}` pages. Hand-write one
    (`tripoli × retail`) once `area_id` exists, and measure it (§3.3).

---

## 6. What I could not verify

- **Whether any of this ranks.** I have no Search Console access, no analytics,
  and `search_logs` is empty. I cannot tell you a single impression, click,
  position, or query. Any traffic or keyword figure in the brief is unsourced.
- **The `/` redirect's status code and whether it is a redirect or a rewrite.**
  WebFetch follows redirects, so I confirmed the content but not the mechanism.
  The mechanism decides whether `/` is a duplicate of `/ar`.
- **Whether Google has actually indexed the duplicate store URLs.** §2.2 is a
  structural defect established from source; the *extent* of the damage needs
  Search Console.
- **The GTM container's contents** — see `20_ANALYTICS_FUNNEL.md` §2.3, where a
  Content-Security-Policy issue makes the whole question moot.
