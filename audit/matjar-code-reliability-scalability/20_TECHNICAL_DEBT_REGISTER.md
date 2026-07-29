# 20 — Technical Debt Register

_Checkpoint 0. Debt = things that work today but cost more the longer they stay. See `24_ISSUES.csv` for the full issue list; this is the durable-debt subset._

| Debt | Type | Interest (why it compounds) | Principal (fix cost) | Trigger to pay down |
|---|---|---|---|---|
| Untyped Supabase clients / 113 `as unknown as` casts (MJ-C01) | Type safety | Every new query adds a cast; column drift is silent; refactors are risky | M (gen types once) | Before major schema changes |
| Hardcoded sector slugs vs registry (MJ-C02) | Architecture | Each new sector = edits scattered across pages; the registry's value erodes | M | Next sector addition |
| God components: `store-products.tsx` (1328), `booking-panel.tsx` (884) (FE) | Maintainability | Change-risk + untestable; every checkout/booking tweak touches a huge file | M–L | Next checkout/booking change |
| Business logic in 194 SQL migrations, no RPC tests (MJ-T01) | Testability | Every RPC change is manually verified; regressions slip | L | Before scaling |
| No staging / forward-only migrations (MJ-REC01) | Reliability | Every migration is a live gamble; grows scarier as data grows | M | Immediately (pre-growth) |
| No APM/observability (MJ-O01/O02) | Operations | Outages invisible; MTTR unbounded; worsens with users | M | Before marketing |
| No partitioning/retention on growth tables (MJ-D04/D05) | Database | Cheap now, expensive to retrofit once tables are huge | L | Before millions of rows |
| Duplicated price formula TS vs SQL (MJ-C04) | Consistency | Two places to keep in sync on pricing changes | S | Next pricing change |
| Heavy client libs eager (MJ-DEP01) | Performance | Bundle grows; every map/QR route pays it | S | Next perf pass |
| Realtime duplication (MJ-P04) | Scalability | 2× the WebSocket bill; harder to unwind as usage grows | M | Before growth |

## Debt posture
The debt is **healthy for the stage**: it is mostly *structural* (types, registry, god files, tests, ops) rather than *rotten* (no dead code, no `any`, no leaked secrets, no broken flows). The two items that convert from "debt" to "risk" the moment traffic arrives are **no observability** and **no staging** — pay those down first because they make every other fix safer to ship.
