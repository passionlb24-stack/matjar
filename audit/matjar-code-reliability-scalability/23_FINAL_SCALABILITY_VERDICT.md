# 23 — Final Scalability Verdict

_Ready · Ready with conditions · Not ready · Unknown until tested. All capacity figures are **modeled, not measured** (no staging — `14`)._

## The 20 questions
| # | Question | Verdict | Basis |
|---|---|---|---|
| 1 | Safe for present usage (build phase, test data)? | **Ready** | tiny data, RLS everywhere, atomic order/booking guards |
| 2 | Ready for a public marketing campaign? | **Not ready** | blockers: MJ-A01, MJ-R01/R04, no APM (MJ-O01), no staging (MJ-REC01) |
| 3 | Ready for 500 stores? | **Ready with conditions** | fix MJ-P01 + emergency data-integrity items |
| 4 | Ready for 2,500 stores? | **Ready with conditions** | + MJ-P02/03/04/05, caching, FK indexes, observability |
| 5 | Ready for 10,000 stores? | **Not ready** | needs pagination everywhere, sitemap chunking, pool strategy, partitioning plan |
| 6 | 100 concurrent users? | **Ready with conditions** | after MJ-P01; within small-plan headroom |
| 7 | 500 concurrent users? | **Ready with conditions** | + caching + realtime dedupe + pagination |
| 8 | 2,000 concurrent users? | **Unknown until tested** | needs staging load test; sitemap/realtime/pool are prime suspects |
| 9 | Which layer fails first? | **Postgres connections + Realtime WebSocket count** | serverless fan-out; PERF-04 doubles channels |
| 10 | Which table becomes problematic first? | **orders / order_items** (unbounded merchant query, no partition), then **store_visits** | MJ-P02, DB-04/05 |
| 11 | Which query slows first? | **merchant orders (unbounded + join)** and **store-page waterfall** | MJ-P02, MJ-P01 |
| 12 | Easiest endpoint to abuse? | **`place_stay_booking` / `buy_tickets`** (anon, no rate-limit) | MJ-R02/R03 |
| 13 | Greatest data-integrity risk? | **Membership/enroll double-renew + coupon over-redemption** | MJ-R01, MJ-R04 |
| 14 | Is stock safe under simultaneous orders? | **Yes (online)** / ⚠️ POS not atomic | 0073 atomic guard; MJ-R06 |
| 15 | Are bookings safe under simultaneous requests? | **Yes** (provider/stay via exclusion constraints); ⚠️ capacity-mode edge (MJ-R07) | 0174/0191 |
| 16 | Is merchant isolation fully protected? | **Yes for cross-tenant**; ⚠️ over-broad *within-store* staff on new engines (MJ-A03) | verified in `07` |
| 17 | Are uploads safe? | 🔍 **Needs verification** — storage policies + verification-doc exposure (MJ-A01) | — |
| 18 | Is monitoring sufficient? | **No** | MJ-O01/O02 |
| 19 | What must be fixed before scaling? | Emergency + Before-Growth in `21` | — |
| 20 | What can wait? | Medium/Long-term in `21` (partitioning, god-file refactor, registry unification) | — |

## Where it fails first (ordered)
1. **Realtime WebSocket count** — doubled per signed-in page (MJ-P04); a hard plan cap.
2. **Postgres connections** — serverless fan-out × unbounded queries (MJ-P02).
3. **Sitemap generation** — OOM/timeout as catalog grows (MJ-P03).
4. **Serverless duration/cost** — store-page waterfall + uncached hot reads (MJ-P01/P05).

## Bottom line
Matjar is a **well-engineered, disciplined codebase** (clean types, RLS everywhere, server-authoritative pricing, strong booking/stock guards, mature indexing) that is **safe at its current build-phase scale** but **not yet ready for a public growth push**. The gap is a **small, concrete set** of fixes: 3 data-integrity/security blockers, 5 scale-hardening performance items, and the two operational foundations (observability + staging). None require re-architecture. With the Emergency + Before-Growth batches in `21`, the realistic reachable target is **Scenario B (2,500 stores / ~150 concurrent) with confidence**, and **Scenario C/D only after a staging load test** confirms the connection-pool and realtime ceilings.

**Confidence: Medium** on code/DB findings (first-hand evidence); **Low** on absolute capacity numbers (no load test). Do not publish a single "supports N users" figure from this audit.
