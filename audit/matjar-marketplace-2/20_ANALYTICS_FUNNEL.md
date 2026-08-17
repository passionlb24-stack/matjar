# 20 — Analytics & the Merchant Funnel

Checkpoint-0 audit. Read-only. Row counts are from the production Supabase
project `wesihatopiznatsyfxer` on 2026-08-17; the code claims are from source.

**The short version:** almost nothing is collected. Of the events the brief's
funnel needs, exactly one and a half exist. A merchant funnel dashboard built on
today's data would be four zeroes and a number, and the brief's own rule —
metrics must not be shown unless the tracking behind them is reliable — means
most of it must not ship yet. Fixing that is cheap; pretending it is fixed is not.

---

## 1. What is collected today, verified

| Store | Rows (2026-08-17) | Written by | Read by |
|---|---|---|---|
| `store_visits` | **169** (152 `path='store'`, 17 `path='product'`), first 2026-07-25 | `track_store_visit()` ← `src/components/track-visit.tsx:57` | `store_audience()` (`0161`), `store_visits_summary()` (`0167`) |
| `orders` | 7 | checkout RPCs | merchant reports |
| `order_events` | 26 | order lifecycle triggers | `order_events_select` policy |
| `order_status_events` | 26 | `0173_order_status_events.sql` | merchant + customer |
| `search_logs` | **0** | `log_search()` ← `src/components/explore-client.tsx:144` (**only call site**) | `admin_search_gaps()`, `admin_attention_queue()` |
| `hub_tool_events` | **0** | `log_tool_use()` ← `src/lib/track-tool.ts:15` | super-admin only |
| `saved_searches` | **0** | Sunday-Market saved-search UI | notification trigger |
| `content_reports` | **0** | reporting UI | admin |
| `reviews` | 5 | | |
| `bookings` | 22 | | |

There is **no generic event table**. `store_visits` is a purpose-built,
two-value (`store`/`product`) page-view log, `search_logs` is a purpose-built
query log, `hub_tool_events` is a purpose-built tool-usage log. Nothing records
an arbitrary named event with properties, and nothing records anything outside
those three narrow shapes.

### 1.1 `store_visits` is well-built and half-wired

`0161_store_audience_analytics.sql` is the best-designed piece of instrumentation
on the platform, and its header comment says why: no PII, referrer bucketed
server-side into `google|instagram|facebook|whatsapp|tiktok|twitter|internal|
direct|other` (the raw referrer is never stored), a random localStorage visitor
id that is not an identity, RLS with **no policies at all** so the table is
unreachable except through two `SECURITY DEFINER` functions. Verified:
`relrowsecurity = true`, zero rows in `pg_policies`.

But `0216_platform_instrumentation.sql:95-97` added `device` and `city` columns
and rebuilt `track_store_visit` to take seven arguments. **`TrackVisit` still
calls it with five** (`track-visit.tsx:57-63`), so `p_device` and `p_city`
default to `null`. Verified: **0 of 169 rows** have a device, **0 of 169** have a
city. Migration 0216's stated purpose — "two columns that unlock a whole
section" — did not happen. Any admin screen showing a device or city split is
showing an empty chart.

### 1.2 `search_logs` is empty, and that is a bug, not low traffic

`log_search` is called from exactly one place: the debounced product search on
`/explore` (`explore-client.tsx:144`). The **main search results page**,
`src/app/[lang]/(site)/search/page.tsx`, which is the page with a `?q=` in the
URL and the one a person actually lands on, **never calls it**.

Consequence: `admin_search_gaps()` (`0216:286`) and the `search_gaps` block of
`admin_attention_queue()` (`0216:261`) return empty forever. Migration 0216's own
comment is the correct framing: *"every day without logging is a day of data that
can never be recovered. What people searched for last month is gone."* That is
currently the state of the platform, and it has been since the migration shipped.

The call is also `void`-ed with no error handling, so a failing RPC and a silent
"nobody searched" are indistinguishable from the client side.

### 1.3 The two third-party tools

**Google Tag Manager — `GTM-M89LK69J`, loaded at
`src/app/[lang]/layout.tsx:101` — is almost certainly blocked by the site's own
Content-Security-Policy.**

`next.config.ts:12` sets:

```
script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com
```

`googletagmanager.com` is not in that list. The inline GTM loader will execute
(`'unsafe-inline'` permits it), but the `<script src="https://www.googletagmanager.com/gtm.js?id=…">`
it injects is blocked. The `<noscript>` iframe (`layout.tsx:106`) is likewise
blocked — there is no `frame-src`, so `default-src 'self'` applies. `connect-src`
also omits `google-analytics.com`, so even a manually loaded GA would not be able
to send a hit.

I did not observe a browser console, so I am reporting this as a source-level
finding rather than an observed failure. But it is high-confidence, it is
trivially checkable (load the site, look for the CSP violation), and it means
**any Google Analytics figure anyone is quoting for Matjar is suspect.** Either
fix the CSP deliberately or remove the GTM tags — a tag manager that silently
fails is worse than none, because people believe it.

**Vercel Analytics** (`<Analytics />`, `layout.tsx:116`) *is* CSP-permitted:
`va.vercel-scripts.com` is in `script-src` and `*.vercel-insights.com` is in
`connect-src`. So it works. But there is **not a single `track()` call in the
codebase** — I grepped the whole of `src/`. It records pageviews and nothing
else. Pageviews cannot answer a single funnel question.

### 1.4 What is conspicuously not tracked

- **Contact clicks.** `store-header.tsx:185` renders `href={tel:${store.phone}}`
  and the WhatsApp equivalent with **no handler, no RPC, no event**. For a
  Lebanese directory this is the primary conversion — most transactions leave the
  platform through that tap — and it is invisible. This is the single most
  valuable missing event on the list.
- **Search on `/search`** (§1.2).
- **Filter usage.** `/explore` filters live in React state and never touch the
  URL (`09_VERTICAL_FILTERS.md` §1.1), so they are unobservable even in server
  logs.
- **Result impressions and result clicks.** No position, no CTR, no way to know
  whether search results are useful.
- **Category / landing page views.** `store_visits` covers only store and
  product pages, so a category page's contribution to a store visit cannot be
  attributed.
- **Cart add / checkout start.** `orders` records only completed orders (7).
  There is no abandoned-funnel data beyond `0120_abandoned_cart.sql`'s own
  narrow scope.

---

## 2. The event model the brief proposes, specified

Below is a proper specification for each event: name, actor, object, required
sector context, properties, and the privacy call. **The "Today" column is the
honest part.**

Conventions:
- `actor` — the acting party. `visitor` = pseudonymous, unauthenticated.
- All events carry a common envelope: `event`, `occurred_at`, `session_id`
  (pseudonymous, session-scoped), `user_id` (nullable), `locale` (`ar`/`en`),
  `device_bucket` (`mobile|tablet|desktop`), `source_bucket` (the existing
  referrer buckets), `sector`, `region`. Nothing else is common.
- **No raw user agent, no IP, no precise geolocation, no free-text query stored
  against an identified user.** See §4.

| Event | Actor | Object | Properties (beyond envelope) | Today |
|---|---|---|---|---|
| `search_performed` | visitor | query | `q_norm`, `q_raw` (capped 120 chars, as `log_search` already does), `surface` (`global\|explore\|sector\|crafts`), `sector`, `region`, `results_count`, `filters_active[]` | **`log_search` exists but fires from one surface; 0 rows.** Needs a second call site + a `sector` column. |
| `search_zero_results` | visitor | query | same as above | Derivable from `search_performed` where `results_count = 0`. Do **not** make it a separate event. |
| `filter_applied` | visitor | facet | `facet_key`, `facet_value`, `sector`, `results_count_after`, `was_zero` | **Not collected. Not collectable** until filters reach the URL. |
| `result_clicked` | visitor | store/product/provider | `object_type`, `object_id`, `position`, `query_id` (ties back to the `search_performed` row) | Not collected. Needs the `query_id` correlation or it is worthless. |
| `business_profile_viewed` | visitor | store | `store_id`, `sector`, `region`, `entry_path` | **Partially: `store_visits` with `path='store'`, 152 rows.** Missing `device`/`city` (§1.1) and missing the landing-page attribution. |
| `offering_viewed` | visitor | product / service / unit / listing | `object_id`, `object_type`, `store_id`, `sector`, `price_bucket` | **Partially: `store_visits` with `path='product'`, 17 rows.** Only covers `products`; nothing for `accommodation_units`, `craft_services`, `listings`, `event_ticket_types`. |
| `contact_initiated` | visitor | store | `store_id`, `channel` (`whatsapp\|phone\|message\|directions`), `sector` | **Not collected at all.** Highest-value gap. |
| `transaction_started` | visitor/customer | order/booking/request | `object_type` (`order\|booking\|stay\|service_request\|quote`), `store_id`, `sector`, `value_bucket`, `currency` | Not collected as an event; inferable only from the row itself existing. |
| `transaction_completed` | customer | order/booking | `object_id`, `store_id`, `status`, `value`, `currency` | **Yes** — `orders` (7), `order_status_events` (26). This is the one end of the funnel that is real. |
| `merchant_onboarding_step` | merchant | store | `step`, `sector`, `completed` | Not collected. Inferable from column nullness, badly. |
| `offering_published` | merchant | product/service | `object_type`, `sector` | Inferable from `created_at`; not an event. |

**Deliberate omissions** — these are events the brief could reasonably want and
that should still not be built:

- `scroll_depth`, `time_on_page`, `rage_click` and similar engagement telemetry.
  At 169 visits they measure nothing, and they are the events most likely to
  need a cookie banner.
- Any event carrying a message body, a phone number, an address, or an order
  line item. That data already lives in its own table with its own RLS; copying
  it into an analytics stream duplicates the blast radius for no analytical gain.
- Cross-session identity stitching. See §4.

---

## 3. The minimum event set before a merchant funnel dashboard is honest

The brief asks for a merchant funnel. A funnel needs each step to be measured by
the same mechanism, or the drop-off rates between steps are arithmetic on
incompatible numbers. Today the platform measures step 3 (`store_visits`) and
step 6 (`orders`) with two unrelated systems and does not measure steps 1, 2, 4
or 5 at all — so **every conversion rate the dashboard could compute would be
wrong**, not merely imprecise.

The minimum honest funnel is five events:

```
1. search_performed        (or category/landing view)
2. result_clicked          → ties 1 to 3
3. business_profile_viewed ← exists as store_visits
4. offering_viewed         ← exists, products only
5. contact_initiated  OR  transaction_started
6. transaction_completed   ← exists as orders
```

**Required before any funnel screen ships:**

| # | Work | Effort | Why it is required |
|---|---|---|---|
| 1 | Call `log_search` from `/[lang]/search/page.tsx`; add a `sector` column and widen the `section` check constraint (`0216:31`) | 1 page edit + 1 migration | Without it step 1 does not exist, and today's zero-result demand data is being destroyed daily |
| 2 | Add `contact_initiated` — a `log_contact(p_store_id, p_channel)` RPC in the shape of `log_tool_use` (`0132`), called from the phone/WhatsApp/directions buttons | ~1 day | It is the actual conversion for most Matjar merchants. Without it the funnel ends at "viewed" and the dashboard says every store converts at 0% |
| 3 | Pass `p_device` to `track_store_visit` (`track-visit.tsx:57`) | 2 lines | Unblocks the device split that migration 0216 already paid for |
| 4 | Extend `offering_viewed` beyond `products` to the other offering tables | ~1 day | Otherwise hospitality/crafts/events merchants see a permanently empty funnel |
| 5 | Decide GTM's fate: fix the CSP or delete the tags | 1 line either way | A silently-blocked tag manager will be cited as evidence in a decision |
| 6 | Add `result_clicked` with a `query_id` back-reference | ~2 days | The only event that makes steps 1→3 a *funnel* rather than two separate counts |

Items 1–3 are hours of work and should be done regardless of whether any
dashboard is built, because they are non-recoverable data. Item 6 is the one
that costs real effort, and it is the one that should wait until items 1–3 have
produced 30 days of data proving anyone searches at all.

**`filter_applied` is deliberately not in the minimum set.** It cannot be
collected until `/explore` puts its filters in the URL
(`09_VERTICAL_FILTERS.md` §1.1), and at 13 merchants there is nothing to learn
from it.

### 3.1 Rules for the dashboard itself

These matter as much as the events:

1. **A metric with no reliable source must render as "not tracked yet", never as
   `0`.** A zero is a claim. `admin_attention_queue()` already models this well
   — its comment at `0216:259` says the search-gaps block is "empty until
   log_search is wired into the UI, and deliberately so: an invented number here
   would be worse than none." Extend that discipline to every tile.
2. **Show the denominator.** "12% conversion" from 17 product views is noise;
   "2 of 17" is a fact a merchant can reason about. At Matjar's volumes, show
   raw counts and suppress percentages below a sample floor (say 30).
3. **State the collection start date on every chart.** `store_visits` begins
   2026-07-25; anything drawn before that is a gap, not a trough.
4. **Never show a merchant a comparison against "platform average"** computed
   from 13 stores. It identifies competitors by inference.
5. **One collection mechanism per funnel step.** Do not mix a Vercel Analytics
   pageview with a Postgres row in the same funnel.

### 3.2 Where events should live

Add a **single** append-only table rather than a fourth purpose-built one:

```
platform_events(
  id, event text, occurred_at timestamptz,
  actor_kind text, user_id uuid null,
  session_id text,            -- pseudonymous, session-scoped
  object_type text, object_id uuid null,
  store_id uuid null, sector text null, region text null,
  props jsonb not null default '{}'
)
```

Written only through a `SECURITY DEFINER` RPC with a server-side allow-list of
event names and a rate limit — exactly the pattern `log_tool_use` (`0132:20`)
and `track_store_visit` (`0216:112`) already use, including the "no RLS policies
at all, access mediated by functions" stance from `0161`. Keep `store_visits`,
`search_logs` and `orders` as they are; they work and they have data. The new
table is for the events that have no home.

Retention: **90 days on raw rows, then aggregate.** Write the pruning job in the
same migration as the table, or it will not be written.

---

## 4. Privacy and PII

Matjar's existing instrumentation is unusually careful and the new work must not
regress it.

**What is already right, and should be treated as the standard:**

- The visitor id is a `crypto.randomUUID()` in `localStorage`
  (`track-visit.tsx:10-24`), generated client-side. It is a pseudonymous
  counting device, not an identity.
- The referrer is bucketed **server-side** into nine values and the raw string is
  discarded (`0216:132-147`). The migration comment on `store_visits.device`
  states the principle exactly: *"Bucketed, not the raw UA — the buckets are what
  a decision is ever made on, and the raw string is a fingerprinting surface."*
- `store_visits` has RLS on with **no policies**; every read goes through
  `store_audience()` / `store_visits_summary()`, both of which check
  `can_manage_store()` first (`0167:14`).
- `search_logs` is admin-read-only (`is_platform_admin()`); a merchant cannot see
  what visitors searched.
- The `Permissions-Policy` header (`next.config.ts:34`) disables camera and
  microphone and scopes geolocation to `self`. `Referrer-Policy` is
  `strict-origin-when-cross-origin`.

**Concerns to address before expanding collection:**

1. **`search_logs.user_id` links a named account to their search history**
   (`0216:35`), and an index exists on it (`search_logs_user_idx`). It is
   admin-read-only, but a super-admin can read "everything user X ever searched
   for". For a gap report you need the *terms*, not who typed them. Recommend
   dropping `user_id` in favour of a coarse `actor_kind` (`guest|customer|merchant`),
   or hashing it with a rotating salt. The analytical value of the identity is
   near zero; the disclosure risk is not.
2. **No retention policy exists on anything.** `store_visits` grows forever. Set
   one, in a migration, now, while the table is 169 rows.
3. **No consent surface.** GTM loads unconditionally at `layout.tsx:101` — before
   any consent — and only happens to be harmless because CSP blocks it (§1.3).
   If the CSP is "fixed", third-party analytics will begin loading for every
   visitor with no notice. Lebanon has no GDPR-equivalent, but the site is
   publicly reachable from the EU and the privacy page
   (`/[lang]/(site)/privacy`) should at minimum describe what is collected. Decide
   this deliberately rather than by CSP accident.
4. **`store_visits.city`** — currently always null. If it is ever populated,
   populate it from a coarse city name, never from an IP-derived lat/lng, and
   never store the IP. The column is `text` and capped at 64 chars, which is the
   right shape.
5. **Never put a search query into an event's `props` alongside a `user_id`.**
   Queries are among the most revealing data a marketplace holds (health,
   finance, legal). `search_logs` already normalises and caps them; keep that as
   the only home for query text.
6. **Do not add cross-device or cross-session identity stitching.** The current
   `localStorage` id resets when the visitor clears storage, which is the correct
   privacy property and costs Matjar nothing it can currently measure.

**Do not collect, at any point on this roadmap:** IP addresses, raw user agents,
precise geolocation, phone numbers or emails inside events, message content,
order line items in the analytics stream, or any third-party advertising
identifier.

---

## 5. What I could not verify

- **Whether GTM actually fires.** §1.3 is derived from `next.config.ts` and
  `layout.tsx`. Confirming it needs one page load with the console open, which I
  could not perform. If it *does* fire, then a CSP header is being overridden
  somewhere outside the repo — which would itself be a finding.
- **What the GTM container contains.** It lives in Google's UI. There may be a
  GA4 property with data I cannot see. Nothing in `src/` pushes to `dataLayer`,
  so at most it holds automatic pageviews.
- **Vercel Analytics figures.** The `<Analytics />` component works, but I have
  no access to the Vercel dashboard. There may be pageview data. There is
  certainly no custom-event data, because there are no `track()` calls.
- **Whether `log_search` is failing versus never being reached.** The call is
  `void`-ed and unchecked (`explore-client.tsx:144`), so 0 rows is consistent
  with both. Distinguishing them needs `query_logs`, which I did not run.
- **Any traffic, impression, click or conversion figure whatsoever.** I have no
  analytics access. Every number in this document is a row count from Postgres.
  If a figure elsewhere in this audit is not a row count or a line of code, it is
  not sourced.
