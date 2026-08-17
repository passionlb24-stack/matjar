# 10 — Gallery & Portfolio

**Headline:** Matjar has excellent *image plumbing* and no *gallery*. Upload, compression, storage, focal-point control and `next/image` wiring are all built and mostly good. What does not exist is any store-level collection of images, and the module that would gate one — `media` — is declared in **15 of 17 sector bundles** and has **zero readers anywhere in `src/`**.

---

## 1. Media types: what the platform actually stores

| Media type | Storage today | Status |
|---|---|---|
| **cover** | `stores.cover_url` + `stores.cover_position` (`migrations/0003_stores_and_business_types.sql:32`) | **EXISTS** — rendered `store/store-hero.tsx:86-101` |
| **logo** | `stores.logo_url` (`0003:31`) | **EXISTS** — `store/store-header.tsx:53-55` |
| **venue** (the premises: dining room, court, treatment room, hotel lobby) | — | **MISSING** — no column, no table, no component |
| **portfolio** (past work) | `store_portfolio.image_url`, one per row (`0133_store_portfolio.sql:12`) | **EXISTS-EMPTY** — 0 rows in production; full merchant UI at `components/portfolio-manager.tsx` |
| **offering** (product / service photo) | `products.image_url` (`0005_products.sql:12`) + `products.gallery jsonb` (`0021_product_depth.sql:4`) | **EXISTS** — `image_url` renders on cards (`store/store-products-section.tsx:228-238`); `gallery` renders on the product page only, never on the profile |
| **staff** (practitioner photo) | `doctors.photo_url` (`0026_healthcare_doctors.sql:9`) | **EXISTS** — `store/store-doctors.tsx:31-39`, 2 rows in production |
| **before_after** | — | **MISSING** — no pairing concept anywhere, despite `beauty` being one of the sectors where it decides the sale |
| **listing** (property / vehicle) | `listings.gallery jsonb` (`0204_listing_depth.sql:12`) | **EXISTS-UNRENDERED** on the store profile — the profile shows `image_url` per card only |
| **unit** (hotel room / chalet) | `accommodation_units.images jsonb` (`0191_accommodation_engine.sql:36`) | **EXISTS-UNRENDERED** on the store profile — 4 units carry this and the profile shows none of it |
| **menu** (dish photos / a photographed paper menu) | `products.image_url` per dish | **PARTIAL** — no menu-document concept; a restaurant with a paper menu has nowhere to put it |
| **market listing** | `market_listings.images jsonb` (`0036_sunday_market.sql:49`) | **EXISTS**, separate surface |
| **gig** | `gigs.image_url` + `gigs.gallery jsonb` (`0065_gigs.sql:14`, `0204:33`) | **EXISTS**, separate surface |
| **craft work** | `craft_works.image_url` rows (`0238_craft_providers_standalone.sql:88`) | **EXISTS**, separate surface — same idea as `store_portfolio`, implemented twice |

**Finding 10.1 — seven parallel image models, no shared one.** Two row-based (`store_portfolio`, `craft_works`), four jsonb-array (`products.gallery`, `listings.gallery`, `gigs.gallery`, `accommodation_units.images`, `market_listings.images`), one scalar pair (`stores.logo_url`/`cover_url`). Nothing shares an accessor, a validator, a moderation path, an alt-text field or a size contract.

**Finding 10.2 — the store itself is the only entity with no gallery.** Products have one. Listings have one. Gigs have one. Units have one. Craft providers have one. The store — the primary object of this whole marketplace — has a cover and a logo.

---

## 2. `media`: a module that gates nothing

`modules-catalog.ts:43` — `| "media"; // gallery + cover + video`
`modules-catalog.ts:85` — `media: { key: "media", labelKey: "media", tier: "free" }`

In sector bundles: `food` (`sectors.ts:185`), `retail` (`:198`), `services` (`:211`), `healthcare` (`:224`), `realEstate` (`:237`), `automotive` (`:250`), `beauty` (`:266`), `fitness` (`:279`), `sportsCourts` (`:292`), `education` (`:305`), `events` (`:318`), `hospitality` (`:331`), `petCare` (`:357`), `contractors` (`:383`), `farm` (`:396`). **Not** in `pharmacy` (`:344`) or `professional` (`:370`).

Grep for `has("media")` / `includes("media")` across `src/`: **zero hits outside `sectors.ts` and `modules-catalog.ts`.** The toggle exists in the merchant modules manager (`merchant/[storeId]/modules/page.tsx:68` builds items from `sectorDefaultModules`), a merchant can switch it off, and nothing changes.

That two sectors lack `media` also matters for the implementation: gating the *cover* on `media` would remove the cover from `pharmacy` and `professional`. **Recommendation: gate only the gallery on `media`; leave cover and logo un-gated as part of `identity`.**

---

## 3. What the schema would need

A single store-level table, replacing nothing initially:

```sql
create table public.store_media (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  kind        text not null default 'venue'
              check (kind in ('venue','work','before','after','team','offering','menu','other')),
  image_url   text not null,
  alt_text    text,
  alt_text_en text,
  caption     text,
  caption_en  text,
  -- the image→offering→CTA link the brief describes
  product_id  uuid references public.products(id) on delete set null,
  provider_id uuid references public.doctors(id) on delete set null,
  pair_id     uuid references public.store_media(id) on delete set null,  -- before/after
  status      text not null default 'approved'
              check (status in ('pending','approved','rejected')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
```

Notes on each choice:
- `kind` replaces the seven parallel models with one discriminator, and drives the tab a photo lands in (§4).
- `product_id` is the missing half of the brief's concept. `store_portfolio` today has `link text` only, rendered as an outbound `target="_blank"` anchor (`components/store-portfolio.tsx:65`) — it sends the customer *off the platform*. A `product_id` lets the card reuse whatever CTA `resolveStoreExperience()` already picked (`store-experience.ts:111-189`), so no new transaction code is written.
- `pair_id` makes before/after a relationship rather than a naming convention.
- `alt_text` — **no image column anywhere in the schema has one today.**
- `status` defaults to `approved` so nothing regresses; see §5.

**Relationship to `store_portfolio`:** do not migrate it in the same phase. It holds 0 rows, so there is no data to move — but its merchant UI, page query (`page.tsx:247-255`) and public component are all live and working. The cheap path is to add `product_id` and `alt_text` to `store_portfolio` now (Phase D in `04`), and fold it into `store_media` as `kind='work'` later, once `store_media` has proven itself with `kind='venue'`.

---

## 4. Gallery tabs per sector

**RECOMMENDATION.** No tabs exist today. Tab set should come from `SectorConfig`, not from a slug switch — the mistake at `page.tsx:499-504` and `:699` is exactly this pattern and should not be repeated.

| Sector | Tabs (first = default) | Why |
|---|---|---|
| `food` | Dishes · The place · Menu | Food is bought on the dish; the room is the second question |
| `retail` | The shop · Products | A physical shop's interior is its differentiator against online |
| `services` | Work · Team | Proof of work is the pitch — `store_portfolio` is 0 rows today |
| `healthcare` | The clinic · Team · Equipment | Cleanliness and equipment carry as much weight as credentials |
| `realEstate` | Properties · Office | Inventory photos, already in `listings.gallery`, unrendered on the profile |
| `automotive` | Vehicles · Showroom | Same |
| `beauty` | Before / After · The salon · Team | The before/after pair is this sector's single most persuasive artefact and has no home |
| `fitness` | The gym · Classes · Trainers | Equipment and floor space are the decision |
| `sportsCourts` | Courts · Facilities | Court surface and lighting decide the booking; no image column exists for `store_resources` today |
| `education` | Campus · Classrooms · Team | Parents are buying an environment |
| `events` | The venue · Past events | Venue photos are the product |
| `hospitality` | Rooms · The property · Amenities | `accommodation_units.images` already holds room photos the profile never shows |
| `pharmacy` | — (no `media` module) | Not in the bundle (`sectors.ts:344`); a photo does not sell a prescription |
| `petCare` | The clinic · Team · Boarding | Owners want to see where the animal stays |
| `professional` | — (no `media` module) | Not in the bundle (`sectors.ts:370`); credentials, not photos |
| `contractors` | Work · Before / After · Team | Same as services, plus before/after, which is native to trades |
| `farm` | The farm · Produce | Provenance is the whole proposition |

Where a sector has one tab only, render a plain grid rather than a tab bar.

---

## 5. Moderation

**Nothing moderates images today.**

`store_portfolio` RLS (`0133_store_portfolio.sql:20-23`):
```sql
create policy store_portfolio_public_read on public.store_portfolio for select using (true);
create policy store_portfolio_manage on public.store_portfolio
  for all using (can_manage_store(store_id)) with check (can_manage_store(store_id));
```
No `status` column. Any store manager's upload is publicly readable the instant it is written.

Compare what the platform does for *documents*: `store_verifications` carries a status, an admin review queue, and a public component that distinguishes self-declared from admin-verified with real care (`components/store-verifications.tsx:17-28`, and `doc_url` excluded from the query at source, `page.tsx:180-184`). Compare `craft_providers.status` defaulting to `'pending'` with the reasoning written into the migration (`0238:16-18`: "The review queue is the only thing between the directory and whoever wants to be in it").

So the platform already knows how to run a review queue and has deliberately chosen not to for images.

**A storage-layer finding that belongs here.** `0008_storage_bucket.sql:10-12`:
```sql
create policy "store_assets_auth_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'store-assets');
```
The only condition is the bucket name. **Any authenticated user can write arbitrary objects into the public `store-assets` bucket**, at any path, regardless of whether they own a store. The comment at `:6-7` correctly explains why there is no SELECT policy (a public bucket serves by URL; a broad SELECT would let clients list every filename) — but the INSERT side has no path scoping to `store_id` and no rate limit. This is an abuse vector for free public hosting, and it is out of scope to fix here but should be recorded.

**Recommended moderation posture** — proportionate, not heavy:
1. `store_media.status` defaults to `'approved'`; images go live immediately. Blocking uploads on review would kill adoption of a gallery that does not exist yet.
2. A **report** path for customers, writing to the existing moderation surface, flipping `status` to `'pending'`.
3. **Pre-publication review only for `beauty`/`healthcare` before-after pairs**, which are the highest-risk medical-claim content on the platform.
4. Scope the storage INSERT policy to a `store_id` path prefix the uploader can manage. `image-upload.tsx:141` already writes to `${folder}/${uuid}.${ext}`, so callers pass a folder — the policy just needs to check it.

---

## 6. Alt text

**No image column in the schema has an alt-text field.** Alt values are computed at render:

| Where | Value | Assessment |
|---|---|---|
| `store/store-hero.tsx:89` | `alt={store.name}` | Acceptable for a decorative banner; arguably should be `""` |
| `store/store-header.tsx:54` | `alt={store.name}` | Should be `"{name} logo"` — a screen reader hears the name twice, next to the `<h1>` at `:65` |
| `store/store-doctors.tsx:34` | `alt=""` | **Wrong.** A practitioner's photo marked decorative. Should be the person's name |
| `store/store-products-section.tsx:231` | `alt={p.name}` | Correct |
| `components/store-portfolio.tsx:43` | `alt={title}` | Correct — the best of the set |
| `components/image-upload.tsx:188` | `alt=""` | Correct, it is a preview inside a labelled control |

**Recommendation:** add `alt_text` / `alt_text_en` to `store_media` and to `store_portfolio`, default them from the title when the merchant leaves them blank, and fix `store-doctors.tsx:34` regardless — that one is a one-character change with real accessibility value.

---

## 7. Image optimization: what exists

This is genuinely well built and deserves to be said plainly.

**Upload path** — `components/image-upload.tsx`:
- Client-side downscale to a 1600px longest side and a ~1MB target (`:13`, `:30`), with a quality ladder `0.85 → 0.4` (`:68-78`) and a PNG→JPEG fallback because `toBlob` ignores quality for PNG (`:64-67`).
- Refuses to upload a *larger* file than the original (`:80`).
- 25MB raw ceiling as a "too big to process on a low-end phone" wall rather than a size budget, with the distinction written into the comments (`:14-16`).
- Native camera/gallery on the mobile shell (`:162-175`).
- Uploads to `store-assets` with `cacheControl: "3600"`, `upsert: false`, UUID filename (`:141-144`).

The reasoning here — "compress down rather than reject, because phone shots are routinely 3–6MB and a hard limit would just block them" (`:10-13`) — is exactly right for the Lebanese mobile-data context.

**Render path:**
- `next/image` used correctly in `store-hero.tsx:86-98` (`fill`, `sizes="100vw"`, `priority`, focal point via `objectPosition`), `store-header.tsx:54` (`sizes="64px"`), `store-doctors.tsx:32-39` (`sizes="56px"`), `store-products-section.tsx:229-235` (`sizes="(max-width: 640px) 100vw, 33vw"`).
- CSP allows `https://*.supabase.co` for `img-src` (`next.config.ts:14`).

**Three defects.**

1. **`components/store-portfolio.tsx:40-45` uses a raw `<img>`** with `// eslint-disable-next-line @next/next/no-img-element`. Portfolio images — the largest, most numerous images the gallery concept will produce — bypass Next's optimizer entirely: no resizing, no WebP/AVIF negotiation, no `sizes`. On a 3-column grid of 1600px JPEGs this is the single most expensive rendering decision on the profile. Any new gallery component must not copy this pattern.

2. **`next.config.ts:41-47` hardcodes one Supabase hostname:**
   ```ts
   hostname: "wesihatopiznatsyfxer.supabase.co"
   ```
   Every `next/image` render is bound to one specific project ref. A staging project, a restored project, or a project migration silently breaks every optimized image on the site while the raw `<img>` at `store-portfolio.tsx:41` keeps working — which would make the failure look like a component bug rather than a config one.

3. **`stores.cover_position` is the only focal-point control that exists** (`store-hero.tsx:95`, and the reasoning at `:39-45` about a 3:1 crop beheading a 16:9 upload is worth preserving). Every other image type — portfolio, staff, unit, product — is centre-cropped with no merchant control, and a gallery multiplies that problem by the number of photos.

---

## 8. Recommended order of work

1. **Fix `store-doctors.tsx:34` alt text.** One line.
2. **Move `next.config.ts` `remotePatterns` hostname to an env-derived value.** Config only.
3. **Implement `media` as a real gate** — gallery only, not cover/logo, so `pharmacy` and `professional` are unaffected.
4. **`store_media` table + one `StoreGallery` component using `next/image`**, gated on `media`, tabbed per §4.
5. **Add `product_id` + `alt_text` to `store_portfolio`** so the image→offering→CTA concept works on the surface that already exists, before building a second one.
6. **Scope the `store-assets` INSERT policy** to a store-owned path prefix.
7. **Before/after pairing** for `beauty` and `contractors`, with pre-publication review for the medical-adjacent case.

Steps 1–3 are hours. Step 5 is the brief's headline concept and is a two-column migration plus a CTA renderer, because the transaction surfaces it needs already exist.
