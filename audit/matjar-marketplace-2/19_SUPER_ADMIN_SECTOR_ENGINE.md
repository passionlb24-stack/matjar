# 19 — Super-Admin Sector Engine

---

## 1. What a super-admin can configure today

I went through every `/admin/*` route. Grouped by what the control actually
changes:

### 1.1 Platform-wide configuration — one setting

`/admin/settings` reads exactly one row (`admin/settings/page.tsx:24-29`):

```ts
.from("app_settings").select("value").eq("key", "usd_lbp_rate")
```

Production confirms it: `app_settings` contains **one row**,
`usd_lbp_rate = 89700`. That is the entirety of "platform settings".

### 1.2 Sector configuration — one table, six columns, and it barely works

`/admin/business-types` → `src/components/business-type-manager.tsx`. Editable:
`slug`, `name_ar`, `name_en`, `icon`, `sort_order`, `is_active`. 17 rows in
production, one per `CategoryKey`.

Three problems:

**(a) `is_active` works — but only by accident of RLS, and its side effect is
worse than the feature.**

No application query filters on it. Grepping `src/` for consumers of
`business_types.is_active` finds only the admin manager that writes it.
`/merchant/new` loads types with
`.select("id, slug, name_ar, name_en").order("sort_order")` — no filter
(`merchant/new/page.tsx:36-39`); `/merchant/[storeId]/edit` is identical
(`edit/page.tsx:66-69`).

The switch nevertheless functions, because the live SELECT policy does the
filtering (`pg_policies`):

```
business_types_select  SELECT  to public
  USING ((is_active = true) OR is_super_admin())
```

So a merchant genuinely stops being offered a deactivated sector. Good outcome,
fragile mechanism — nothing in the application says so, and a future
`service_role` or `SECURITY DEFINER` read path would silently reintroduce it.

**The real problem is what happens to existing stores.** Every store page reads
its sector through a PostgREST embed — `business_types(slug)` in
`src/lib/data/store-view.ts:111`, `src/lib/data/stores.ts:80`,
`merchant/[storeId]/layout.tsx:62`, `merchant/[storeId]/page.tsx:110`. When RLS
hides the parent row, the embed comes back **null**, and every one of those call
sites falls back the same way:

```ts
const category = (s.business_types?.slug as CategoryKey) ?? "retail";
```

So deactivating `hospitality` does not hide existing hotels — it silently
**re-renders every one of them as a retail shop**, with a retail dashboard, a
retail module set and a retail public page. The admin sees nothing wrong,
because `is_super_admin()` makes the embed resolve normally for them.

An admin-facing switch whose real effect is "quietly reclassify every existing
store of this type as a shop, for everyone except me" is not a usable control.
It needs to mean one specific thing — most usefully "no *new* stores of this
type" — and be enforced in the query where it can be read, not as a side effect
of a row-visibility rule.

**(b) The slug guard is client-side only, and only on create.**
`business-type-manager.tsx:17` builds `SUPPORTED_SLUGS` from `categoryKeys` and
blocks unsupported slugs — but `slugUnsupported` is computed as
`editingId === "new" && !SUPPORTED_SLUGS.has(...)` (line ~79). **Editing an
existing type's slug is unguarded**, and the whole check is a React state
comparison. RLS lets a super-admin write any row; a `PATCH` from any REST client
bypasses it entirely.

The consequence is not cosmetic. `getSector(category)` (`sectors.ts:410-412`) is
`{ ...sectorConfig[category], flow: categoryModule[category] }`. Spreading
`undefined` yields `{}`, so `sector.modules` is `undefined`, and
`layout.tsx:167` does `sector.modules[group]` — a TypeError on the store shell.
**An unrecognised slug takes down every page under `/merchant/[storeId]` for
every store of that type.** The manager's own comment (lines 14-16) says exactly
this. The guard is right; its placement is wrong.

**(c) Delete is unguarded.** `remove()` deletes the row with no check for
referencing stores. `stores_business_type_id_fkey` is a plain
`FOREIGN KEY (business_type_id) REFERENCES business_types(id)` with **no
`ON DELETE` clause**, so Postgres defaults to `NO ACTION` and the delete will
fail with a constraint violation — surfaced to the admin as
`dict.auth.errorGeneric`, a generic "something went wrong". The data is safe;
the admin is left guessing.

### 1.3 Per-store overrides an admin holds

From `/admin/stores` (`admin-stores-client.tsx`): approve / reject / suspend
(`status`), `is_verified`, `commercial_reg_verified`, `featured_until`. From
`/admin/subscriptions`: `plan`, and `is_verified` as an automatic side effect
(`admin-subs-client.tsx:127` — see `12_REVIEWS_TRUST.md` §5).

### 1.4 Content and moderation

`/admin/pages` (site pages), `/admin/deals`, `/admin/academy`, `/admin/leaders`,
`/admin/questions`, `/admin/reviews` (delete only), `/admin/verifications`
(approve/reject), `/admin/market/*`, `/admin/crafts`, `/admin/delivery`,
`/admin/jobs`, `/admin/freelance`, `/admin/wholesale`, `/admin/messages`,
`/admin/broadcast`.

### 1.5 Admin access control — the one part that is properly built

`0149_admin_roles_granular.sql` adds `profiles.admin_permissions jsonb`,
`admin_can(section)`, `is_platform_admin()`, and a
`prevent_admin_perm_change()` trigger so a user cannot self-grant sections.
`src/lib/admin-guard.ts` re-checks per page and its comment is explicit that
"RLS remains the real write enforcement; this is defense-in-depth on the page
shell." That is exactly the right division, and it is the template the rest of
this document argues for.

---

## 2. What the brief wants configurable, versus what it would cost

| the brief wants | today | honest cost |
|---|---|---|
| add / edit a sector | slug must already exist in `sectors.ts` | **cannot be data-only** — see §4 |
| turn a sector on/off | `is_active` exists; enforced only by RLS, with a damaging side effect on existing stores | **small** — make it explicit in the query and stop it reclassifying live stores |
| choose a sector's modules | `sectorConfig[c].features` in code; per-store overrides in `store_modules` | **small** — the shape already exists |
| choose module order in the dashboard | `sectorConfig[c].modules` in code | **small** |
| set publish requirements per sector | nothing | **medium** — new table, plus the RPC in `15_PUBLISH_READINESS.md` §5.5 |
| set completeness weights per sector | nothing | **medium** — new table (`14_PROFILE_COMPLETENESS.md`) |
| set a sector's vocabulary (nouns/labels) | `customersNoun` + `itemsKey` in code, dictionary-backed | **do not move** — see §4 |
| directory-only per sector | nothing | **small** — one enum default per sector |
| define new fields / new tables per sector | nothing | **do not build** — see §3 |

---

## 3. CONSTRAINED configuration — and explicitly not a schema builder

The brief warns against an unrestricted admin schema builder. That warning
should be taken literally, and Matjar is not currently at risk of building one —
but it *is* one bad decision away, because `business-type-manager.tsx` already
lets an admin type a free-text `slug` that the rest of the system treats as a
code identifier. That is a schema builder in miniature: an admin typing a
string that the application dereferences. It already has a demonstrated failure
mode (§1.2b).

### The rule

> **An admin may choose among options that code already implements. An admin may
> never create an option that code has not implemented.**

Everything below follows from that one sentence.

### What a constrained sector engine looks like

A single table, every value constrained to a code-defined enumeration:

```
sector_config
  sector_slug        text primary key   -- FK-equivalent: must be in CategoryKey
  is_active          boolean
  publish_mode       store_publish_mode -- 'transactional' | 'directory'
  sort_order         int
  updated_by / updated_at

sector_module_config
  sector_slug        text
  module_key         text               -- must be in FeatureModuleKey
  enabled            boolean
  group_key          text               -- must be in OsGroupKey
  position           int
  primary key (sector_slug, module_key)

sector_publish_rule
  sector_slug        text
  rule_key           text               -- must be in a code-defined RuleKey enum
  required           boolean
  weight             smallint           -- completeness weight, 0-100
  primary key (sector_slug, rule_key)
```

Three enforcement layers, all necessary:

1. **CHECK constraints listing the valid values.** `module_key in ('catalog',
   'menu', 'orders', …)` — the 23 keys of `FeatureModuleKey`. A new module means
   a migration, which means a code deploy, which is correct because a new module
   *is* code.
2. **A resolver in code that falls back, never throws.** Where today
   `getSector()` returns `{}` for an unknown slug and the shell crashes, the
   resolver must start from the compiled `sectorConfig[slug]` and overlay only
   the DB rows it recognises, dropping anything it does not. A corrupt config row
   should degrade a sector to its code defaults, not 500 the dashboard.
3. **RLS: super-admin only for writes, public read.** `store_modules` already
   demonstrates the exact pattern in production —
   `store_modules_manage USING (is_store_owner(store_id) OR is_super_admin())`
   plus `store_modules_public_read USING (true)`.

### What must be refused, permanently

- Creating a sector with a slug the code does not know.
- Defining new fields, new columns, new tables, or arbitrary JSON blobs that
  become rendered form fields.
- Free-text CSS, HTML, or template strings.
- Anything that lets an admin change the meaning of a trust badge, a publish
  rule's *semantics* (as opposed to its on/off), or an RLS predicate.

The last one deserves emphasis. A "configurable" system whose configuration can
weaken a security boundary is not configuration, it is a second, undocumented
permission system. Every guard trigger this codebase has built —
`guard_store_platform_columns` (`0217`), `guard_profile_platform_columns`
(`0224`), `prevent_admin_perm_change` (`0149`) — exists because someone found a
column that shouldn't be writable and closed it. Do not reopen that surface
through a config table.

---

## 4. What can move to the database, and what must stay in code

Going through `src/lib/sectors.ts` field by field.

### Safe to move — pure data with a code-constrained value set

| field | why it is safe | constraint |
|---|---|---|
| `is_active` (`business_types`) | already exists and already enforced; needs an explicit query filter and a defined meaning | must not reclassify existing stores |
| `sort_order` | ordering only | none |
| `name_ar` / `name_en` / `icon` | already in `business_types` | `icon` should become an enum of the Lucide names actually imported — a free-text icon name that does not resolve is a rendering bug today |
| `features: FeatureModuleKey[]` | a **subset selection** from a code-defined set of 23 | CHECK against the 23 keys; resolver drops unknowns |
| `modules: Record<OsGroupKey, OsModuleKey[]>` | membership **and order** within 4 fixed groups | CHECK against the 34 `OsModuleKey`s and 4 `OsGroupKey`s |
| `publish_mode` default per sector | new; two values | enum |
| publish requirements (on/off per rule) | the *rules* are code; the *toggle* is data | CHECK against a code-defined `RuleKey` |
| completeness weights | numbers | `0..100`, and validate the per-sector sum |
| `minPlan` per module per sector | tier gating varies by market, not by code | enum `free\|pro\|business` |

### Must stay in code — because it is behaviour, not data

| field | why |
|---|---|
| `Icon: LucideIcon` | a component reference. Cannot serialise across the RSC boundary — `merchant-sidebar.tsx:57-61` already looks icons up client-side by key precisely for this reason. |
| `heroTint` / `iconTint` | raw Tailwind class strings. Admin-editable class names are a CSS injection surface, and Tailwind's JIT will not have generated a class nobody wrote in source, so they would silently render as nothing. |
| `flow.kind` (`commerce` \| `booking`) | selects the transaction engine. Flipping a live sector from `booking` to `commerce` changes which tables the checkout writes to. |
| `flow.itemsKey` / `addKey` | dictionary keys. Editable keys mean a typo produces `undefined` in the UI. The *strings* belong in `src/i18n/dictionaries/*` where they already are; the *key* is code. |
| `simplifiedItem` | changes which product form fields exist. |
| `customersNoun` | a dictionary key (`dict.os.nouns[...]`), same argument. |
| `sectorPrimarySetup()` | returns a **table name** that gets interpolated into a query (`page.tsx:595`). An admin-editable table name is a query-construction surface. Absolutely not. |
| `MODULE_CATALOG` `dependsOn` / `conflictsWith` | invariants that keep a module set coherent (`withDependencies`, `modules-catalog.ts:105-116`). If an admin can break "delivery implies orders", the resolver can produce a state no page handles. |
| `WIDGET_ORDER` / `quickDefs` | dashboard layout. Movable *later*, once §17's recommendation to derive them from `sector.modules` lands — at which point they stop being separate config and inherit whatever `modules` says. |

### The dividing line, stated once

**Move a field to the database only if every value it can take is already
implemented in code, and an unrecognised value can be safely ignored.** Anything
whose value is dereferenced — a table name, a dictionary key, a CSS class, a
component — stays in code, because "unrecognised" for those means "crash" or
"blank", not "ignore".

---

## 5. The `store_modules` precedent — already right, and already limited correctly

`/merchant/[storeId]/modules` (`modules/page.tsx`) shows a merchant only their
**own sector's** modules, not the full 23-key catalog. The comment at lines
66-67 says why: "that would offer a clothing shop 'courses'". Effective state is
`sectorDefaultModules(category)` overlaid with `store_modules` rows, resolved
through `withDependencies()` (`sectors.ts:445-457`).

Production: 7 rows in `store_modules`. So merchants do use it, sparingly.

This is precisely the architecture §3 proposes, one level down. The sector engine
is the same idea one level up: code defines the catalog, config selects from it,
a resolver reconciles the two and keeps the result coherent. Building it the same
way means one mental model and one resolver shape, not two.

---

## 6. What Matjar is currently at risk of

Being direct, since the brief asks for it:

**Risk 1 — a schema builder by accident.** `business-type-manager.tsx` already
lets a super-admin type a free-text identifier that the application
dereferences, guarded only by React state on the create path. The next natural
feature request ("let me add a sector") turns that into a real schema builder.
The mitigation is to make the constraint structural — a CHECK constraint and a
non-throwing resolver — before anyone asks.

**Risk 2 — configuration that outruns implementation.** If an admin can switch a
sector's `flow.kind` to `commerce`, they have promised a cart the code will not
build for that sector's data model. Every configurable field must be a choice
among things that already work end to end.

**Risk 3 — badges as configuration.** Nothing in the sector engine should be
able to grant, define, or rename a trust badge. `12_REVIEWS_TRUST.md` documents
three badges that are already weaker than they appear
(`store_verifications.status`, `product_reviews.verified`, `stores.is_verified`).
Making badge behaviour admin-configurable before those are fixed would make an
already-confused trust story unauditable.

**Risk 4 — config that can weaken RLS.** Keep every proposed table's writes
`is_super_admin()`-only, keep the reads public, and never let a config value
appear inside a policy predicate.

---

## 7. Recommended sequence

1. **Make `is_active` mean one defined thing.** Add an explicit
   `.eq("is_active", true)` on `/merchant/new` and `/merchant/[storeId]/edit`
   (so the rule is readable in the code, not only in a policy), and stop a
   deactivated sector silently reclassifying its existing stores as `retail` —
   either by exempting the sector embed from the `is_active` filter, or by
   caching `stores.sector_slug` alongside `business_type_id`.
2. **Make the slug guard structural** — a CHECK constraint on
   `business_types.slug` listing the 17 `CategoryKey`s, and make `getSector()`
   fall back to a safe default instead of spreading `undefined`. Also extend the
   client guard to the edit path. This removes a live crash vector.
3. **Give `business_types` delete a real check** — count referencing stores and
   say so, instead of surfacing a constraint violation as "something went
   wrong". Better: replace delete with deactivate.
4. **Add `sector_config`** (`is_active`, `publish_mode`, `sort_order`) and the
   resolver that overlays it on the compiled defaults, with tests that a corrupt
   row degrades rather than crashes.
5. **Add `sector_module_config`** — module membership, group, order, `minPlan`.
   Reuse `store_modules`' RLS shape verbatim.
6. **Add `sector_publish_rule`** once the publish RPC from
   `15_PUBLISH_READINESS.md` §5.5 exists — the rules must be implemented in that
   function before they can be toggled from a table.
7. **Never** add free-text schema definition. If a new sector genuinely needs a
   field the platform does not have, that is a migration and a code change, and
   it should stay that way.

---

## Could not verify

- The `retail` fallback consequence in §1.2a is reasoned from the four call
  sites and from PostgREST's documented behaviour of returning `null` for an
  embed whose parent row RLS hides. It was not reproduced against a deactivated
  sector — all 17 rows are `is_active = true` in production and I made no
  writes. Confirm it on a branch before acting on it.
- Writes on both `business_types` and `app_settings` are `is_super_admin()`-only
  for INSERT/UPDATE/DELETE, confirmed from `pg_policies`. So §1.2b's concern is
  about *which* super-admin writes, not about unauthorised writers.
- The crash consequence in §1.2b is reasoned from the code path
  (`getSector` → `{...undefined}` → `sector.modules[group]`) and from the
  manager's own comment asserting it, not reproduced. It should be confirmed on a
  branch before being quoted as a defect.
- No admin was interviewed. Which of these controls anyone actually wants is
  unknown; the priorities in §7 are ordered by risk and cost, not by demand.
