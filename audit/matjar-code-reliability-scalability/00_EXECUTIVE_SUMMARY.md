# 00 — Executive Summary
### Matjar — Code Reliability & Scalability Audit · Checkpoint 0 (inspection only)
_Date: 2026-07-29 · No production behavior modified · No load test run (no staging)_

## What was done
A full read-only audit: repository inventory (454 TS files), static analysis (tsc/lint/tests/build), 194 migrations + live DB schema/index/RLS inspection (read-only), Supabase security advisors, and five parallel evidence-gathering passes (RLS, backend RPCs, frontend, performance, dependencies). Evidence is cited by `file:line` / migration throughout the 24 report files.

## Headline
**Matjar is a well-engineered, unusually disciplined codebase that is safe at its current build-phase scale but not yet ready for a public marketing push.** The gaps are a **small, concrete set** — not a re-architecture: 3 data-integrity/security **blockers**, 5 scale-hardening performance items, and 2 operational foundations (observability + staging).

## Strengths (evidence-backed)
- **Type/code discipline:** 0 `any`, 0 `@ts-ignore`, 0 stray `console.log`, 0 empty business catches, 0 TODO/FIXME, no floating promises, no leaked secrets. tsc + build clean; 43/43 tests; i18n parity.
- **Security posture:** RLS enabled on **every** table; verified cross-tenant isolation; privilege-escalation triggers; **0 ERROR-level** Supabase advisors; parameterized queries only.
- **Commerce correctness:** server-side price/stock recompute in DB RPCs (browser cannot cheat); atomic order oversell guard; `btree_gist` exclusion constraints for provider & accommodation double-booking; atomic ticket capacity; order idempotency (cart).
- **Database:** mature indexing (double-book uniques, GIST overlaps, trigram search, FK indexes); cached public store/product views with tag invalidation.
- **Dependencies:** all 22 declared + used; none abandoned; no supply-chain surprises.

## Critical findings (fix before growth)
| # | Finding | Severity | Ref |
|---|---|---|---|
| 1 | `store_verifications` public read exposes unverified/rejected licence **documents + numbers** and enables a **fake "verified" badge** (`using(true)`, no status filter) | **High** | MJ-A01 |
| 2 | Membership/enrollment **double-renew race** (no unique index; TOCTOU) | **High** | MJ-R01 |
| 3 | Coupon **over-redemption** under concurrency (`used_count` bumped unconditionally) | **High** | MJ-R04 |
| 4 | Anonymous **stay/ticket** RPCs have **no rate limit** → inventory/capacity denial | Medium | MJ-R02/R03 |
| 5 | `get_push_subs` anon-callable, guarded only by one shared static secret | Medium | MJ-A02 |
| 6 | Store-page **query waterfall** (~12–18 sequential awaits) on the top SEO route | High (perf) | MJ-P01 |
| 7 | **Unbounded** list queries (merchant orders, store reviews, admin) | High (perf) | MJ-P02 |
| 8 | **Sitemap** enumerates all rows × locales → OOM/timeout at scale | High (perf) | MJ-P03 |
| 9 | **Duplicate realtime channels + pollers** (2× WebSockets per signed-in page) | High (perf) | MJ-P04 |
| 10 | **No observability (APM/alerts)** + **no staging** (migrations applied to prod un-rehearsed) | High (ops) | MJ-O01/REC01 |

Several data-integrity items (2, 4) sit in engines shipped this development cycle (memberships, stays, tickets) — they are **latent race conditions**, harmless at today's 0-order test volume, but must close before concurrent traffic arrives.

_Full list: `24_ISSUES.csv` (45 issues). Fix order: `21_PRIORITIZED_ACTION_PLAN.md`._

## Technical scorecard (1–10, with evidence)
| Dimension | Score | Evidence |
|---|---:|---|
| Code quality | 9 | 0 any/ignore/console/TODO; tsc+build+tests clean |
| Maintainability | 6 | god components (1328/884 lines); untyped clients → 113 casts; hardcoded slugs |
| Architecture | 7 | clean RPC-centric model + resolver registry; registry partly bypassed |
| Frontend reliability | 7 | effect cleanup clean, boundary-safe; but waterfall + product-order idempotency gap |
| Backend reliability | 7 | atomic RPCs, server-authoritative; a few race/rate-limit gaps |
| Database design | 8 | RLS everywhere, typed enums, soft-deletes, mature indexing |
| Query performance | 6 | strong indexes, but unbounded lists + waterfall + uncached hot reads |
| Authorization | 7 | isolation holds; AUTH-01 leak + over-broad staff regressions |
| Security | 6 | strong base; one High leak + rate-limit/push gaps |
| Data integrity | 6 | order/booking/ticket solid; membership/coupon races |
| Concurrency safety | 6 | exclusion/atomic guards where they matter most; 4 real race gaps |
| Error handling | 7 | clean error codes, no leakage; no retry/reconciliation |
| Test coverage | 3 | 8 files/43 tests; no RPC/RLS/concurrency tests |
| Performance | 6 | good caching foundation, key hot-path gaps |
| Caching | 6 | store/product cached; offers/deals/market uncached |
| Observability | 2 | no APM/alerts/uptime/structured logs |
| Deployment safety | 4 | push-to-main, no staging, forward-only migrations |
| Disaster recovery | 3 | backups assumed but untested; no RPO/RTO |
| Horizontal scalability | 6 | serverless auto-scales; realtime + pool are ceilings |
| Database scalability | 6 | indexed but no partition/retention; unbounded queries |
| Production readiness | 5 | fine for build phase; 4 blockers before growth |

**Weighted overall: ~6.0/10 — "solid build-phase platform, a defined checklist away from growth-ready."** Do not read this as a single capacity number (see `23`).

## Recommendation
Proceed to **Checkpoint 1** (safe additive tests — RPC/RLS/concurrency harness, query benchmarks, staging load scripts) only on approval. **Do not** run load tests until a disposable staging environment exists (`13`/`14`). The Emergency batch in `21` (items 1–6) should be scheduled regardless of scale timing — those are correctness/privacy fixes, not performance tuning.

---
_Reports in this directory: 00 (this) · 01 architecture · 02 inventory · 03 code-quality · 04 frontend · 05 backend/API · 06 database · 07 RLS/authz · 08 security · 09 concurrency · 10 performance · 11 caching · 12 scalability/capacity · 13 load-test-plan · 14 load-test-results (not executed) · 15 observability · 16 failure/recovery · 17 infra/cost · 18 dependencies · 19 test-gaps · 20 tech-debt · 21 action-plan · 22 readiness-checklist · 23 final-verdict · 24 issues.csv_
