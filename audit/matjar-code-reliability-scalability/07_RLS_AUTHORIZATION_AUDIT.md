# 07 — RLS & Authorization Audit

_Checkpoint 0. Evidence = `supabase/migrations/*.sql`, cross-checked against live policies (read-only). Helper functions (`is_super_admin`, `can_manage_store`, `staff_can`, `owns_store`, `admin_can`, `user_is_active`) all use `set search_path=''` and are non-recursive — the helper layer is sound._

## Verdict
The authorization model is **disciplined**: every public table has RLS enabled; money/inventory/lead/stay/ticket **writes go through `SECURITY DEFINER` RPCs** that re-check `can_manage_store`/store-active; direct table writes are denied; `0159` tightened over-broad staff reads; privilege-escalation triggers (`prevent_role_change`, `prevent_admin_perm_change`) stop self-escalation. **Cross-tenant isolation holds** on all sensitive transaction tables — no policy lets merchant A read merchant B, or customer A read customer B. The findings below are the exceptions.

## Role × Table × Operation matrix (sensitive tables)
anon=guest · cust=customer · owner=store owner · staff=permissioned store_staff · admin=super_admin · RPC=mediated by DEFINER function · — = denied

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| orders | cust(own)·owner·staff`orders`·admin | cust(own+active); guest via RPC | owner·staff`orders` | — |
| order_items | cust(own)·owner **(not staff/admin)** | cust(own); guest RPC | — | — |
| stores | **public(active)**·owner·admin | owner | owner·admin | — |
| products | **public(active)**·owner·staff`products`·admin | owner·staff`products` | owner·staff`products` | — |
| bookings | cust(own)·owner·staff`bookings`·admin | cust(own+active) | owner·staff`bookings` | — |
| leads | owner/staff (`can_manage_store`) | RPC only | owner/staff | — |
| stay_bookings | manager·cust(own) | RPC only | manager | — |
| event_tickets | manager·cust(own) | RPC only | manager | — |
| event_ticket_types | **public(active)**·manager | manager (any staff) | same | same |
| product_modifier_groups | **public (no status filter)** | staff`products` | staff`products` | staff`products` |
| store_staff | self·owner | owner | owner | owner |
| profiles | own·admin | signup trigger | own·admin (role change blocked) | — |
| notifications | own | trigger/RPC | own | — |
| conversations/messages | participants | sender=self&participant | participant | — |
| store_verifications | **anon: ALL rows, ALL statuses, incl. doc_url + number** | owner/admin | owner/admin | owner/admin |
| loyalty_ledger | own | RPC/trigger | — | — |
| order_payments | manager·admin·cust(own order) | RPC only | — | — |

`store_visits` (0161) = RLS-enabled, **no policy = deny-all by design** (all access via DEFINER funcs) — intentional, not a defect.

## Findings

| ID | Title | Severity | Evidence |
|---|---|---|---|
| AUTH-01 | `store_verifications` public read exposes unverified/rejected submissions + raw documents (`doc_url`, `number`); no `status` filter | **High** | `0126_store_verifications.sql:32` `using (true)` |
| AUTH-02 | `get_push_subs` DEFINER granted to `anon`, guarded only by one shared static secret → enumerate any user's Web-Push crypto | **Medium** | `0049_push_on_events.sql:18`, `grant … to anon` |
| AUTH-03 | Event/accommodation/lead "manage" policies use `can_manage_store` (any staff row) not `staff_can(section)` → over-broad staff read of attendee/guest PII | Low/Medium | `0193:43`, `0191:87`, `0190` |
| AUTH-04 | `product_modifier_groups` public read has no product-status filter → anon enumerates draft/hidden menu structure | Low | `0194_food_modifiers.sql:31` |
| AUTH-05 | `order_items` SELECT never extended to staff/admin (under-permissive consistency gap, not a leak) | Low | `0006_orders.sql:86` |

### AUTH-01 (High) — the priority finding
```sql
create policy store_verifications_public_read on public.store_verifications
  for select using (true);   -- 0126_store_verifications.sql:32
```
Returns **every column of every row to `anon`** — including `doc_url` (uploaded licence/certificate scan), `number` (licence/registration number), `issuer`, `verify_url` — and does **not filter on `status`**, so `submitted` (self-asserted, unreviewed) and `rejected` rows are indistinguishable from `verified`. Two problems: (1) **document/PII leak** — every business's raw licence URL + number is world-readable, including rejected ones; (2) **trust-badge integrity** — any consumer checking row *presence* instead of `status='verified'` renders an unearned "verified" badge.
**Fix:** public policy `using (status='verified')`, expose only badge-safe columns via a view; keep `doc_url`/`number` readable only to `can_manage_store(store_id) or is_super_admin()`.

### AUTH-02 (Medium)
`get_push_subs(p_uid, p_secret)` bypasses `push_subscriptions` own-row RLS: any `p_uid` + the single shared `push_hook_secret` returns that user's push crypto, and it's callable by `anon`. Protected only by one long-lived plaintext secret. Sibling `admin_list_push_subscriptions` does it correctly with `is_super_admin()`. **Fix:** revoke from `anon`, restrict to service role, rotate the secret.

### AUTH-03 (Low/Medium) — regression of the 0159 hardening
`0159` re-scoped POS/expenses/customers/inventory to `staff_can(store,'perm')` precisely so an "orders-only" staffer couldn't read customer PII. The newer engines (0190–0194, shipped this cycle) reintroduced coarse `can_manage_store`, so **any** staff row can read/modify ticket types, accommodation units, stay bookings (guest name+phone), event tickets (attendee name+phone), and leads. Store-scoped (not cross-tenant), but the same over-broad pattern 0159 eliminated. **Fix:** gate on `staff_can(store_id,'<section>')`.

## Acceptable broad reads (reviewed, justified)
`store_portfolio`, `store_resources`, `store_membership_plans`, `store_classes/courses`, `service_providers`, `provider_availability_*`, `store_modules`, `store_couriers`, `product_questions/reviews`, `app_settings` — storefront catalog/config content with clear public-read need, each paired with a `can_manage_store`-gated write. Recommend a column check on `store_couriers`/`service_providers` to confirm no private phone is exposed. No policy defect.
