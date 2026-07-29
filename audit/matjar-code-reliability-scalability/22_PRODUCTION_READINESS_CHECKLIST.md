# 22 — Production Readiness Checklist

_✅ = in place · ⚠️ = partial / needs work · ❌ = missing · 🔍 = needs runtime verification_

## Security & Authorization
- ✅ RLS enabled on every public table
- ✅ Cross-tenant isolation on sensitive tables (verified)
- ✅ Privilege-escalation triggers (role/admin-perm)
- ✅ No leaked secrets; no `any`; parameterized queries only
- ✅ Supabase security advisors: 0 ERROR-level
- ❌ `store_verifications` public read leaks docs + fake-badge (MJ-A01) — **blocker**
- ⚠️ `get_push_subs` anon + shared secret (MJ-A02)
- ⚠️ Public write RPCs missing rate-limits (stay/tickets)
- 🔍 Push API-route auth/replay; JSON-LD escaping; CSP headers live

## Data Integrity & Concurrency
- ✅ Order oversell guard (atomic)
- ✅ Provider/accommodation double-book (exclusion constraints)
- ✅ Ticket capacity (atomic)
- ✅ Order idempotency (cart)
- ❌ Membership/enrollment uniqueness (MJ-R01) — **blocker**
- ❌ Coupon single-use under concurrency (MJ-R04) — **blocker**
- ⚠️ POS stock atomicity; payment double-submit; product-page order idempotency

## Performance & Scalability
- ✅ Mature indexing; trigram search; cached public store/product views
- ⚠️ Store-page waterfall (MJ-P01)
- ⚠️ Unbounded lists (reviews/orders/admin) (MJ-P02)
- ⚠️ Sitemap unbounded (MJ-P03)
- ⚠️ Realtime duplication (MJ-P04)
- ⚠️ Hot public reads uncached (MJ-P05)

## Reliability & Operations
- ✅ Atomic RPC writes; isolated notification failures
- ❌ Error tracking / APM (MJ-O01) — **operational blocker for growth**
- ❌ Alerting / uptime / structured logs (MJ-O02)
- ❌ Staging environment; migration rehearsal (MJ-REC01) — **operational blocker**
- 🔍 Backup-restore tested; RPO/RTO defined (MJ-REC02)

## Code Quality & Testing
- ✅ tsc clean · build clean · 43/43 tests · i18n parity · 0 `any`/console/TODO
- ⚠️ Untyped clients / 113 casts (MJ-C01)
- ⚠️ Hardcoded slugs vs registry (MJ-C02)
- ❌ RPC/RLS/concurrency tests (MJ-T01)
- ⚠️ 14 ESLint errors (React-19 hook rules)

## Verdict
**Not production-ready for a marketing push** until the four blockers (MJ-A01, MJ-R01, MJ-R04, and observability MJ-O01 + staging MJ-REC01) are addressed. **Suitable for the current controlled/build phase** (test data, low traffic) as-is. See `23` for the graded verdict.
