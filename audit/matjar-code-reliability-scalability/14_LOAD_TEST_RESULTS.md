# 14 — Load Test Results

## Status: NOT EXECUTED

No load, stress, soak, spike, or contention test was run.

### Why
1. **No safe staging environment exists.** The repository and infrastructure expose a single Supabase project (`wesihatopiznatsyfxer`) and a single Vercel target — this is **production**. The audit safety rules (and good practice) forbid load-testing production: it would create fake orders/bookings/tickets, mutate the live DB, spam notifications, and generate real WhatsApp deep-link traffic.
2. **No load-testing tool is installed** (k6/Artillery/Locust absent), and installing/running one is outside Checkpoint 0.
3. **Checkpoint gating.** Per the audit protocol, load testing is Checkpoint 2 and requires explicit approval + a confirmed disposable environment.

### What is required to execute (Checkpoint 2)
- A disposable Supabase project (branch/clone) seeded via the `13` data-generation plan.
- A Vercel preview deployment bound to that DB.
- Stubbed notification / push / WhatsApp integrations.
- Explicit user approval to install k6 and run the `13` suites.
- Access to Supabase DB metrics (CPU, connections, slow queries) and Vercel function metrics during the run.

### Provisional acceptance targets (to apply once executed)
| Class | p95 target |
|---|---|
| Public cached pages | < 1 s |
| Normal dynamic reads | < 1.5 s |
| Critical writes (order/booking) | < 2 s |
| Error rate at expected peak | < 1 % |
| Data integrity | **0 oversold stock · 0 duplicate confirmed bookings · 0 cross-store access · 0 corrupted partial txns** |

**No performance or capacity claim in this audit is backed by measurement.** The `12_SCALABILITY` numbers are desk estimates only.
