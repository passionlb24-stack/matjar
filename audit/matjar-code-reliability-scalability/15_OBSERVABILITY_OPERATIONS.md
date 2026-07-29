# 15 — Observability & Operations

_Checkpoint 0. Assessment of whether the team can detect a problem before users report it._

## Current state
| Capability | Status | Evidence |
|---|---|---|
| Product analytics | Vercel Analytics | `@vercel/analytics` |
| Store analytics | in-app `store_visits` + `store_visits_summary` RPC | `0161`, `0173` |
| Audit log | `audit_logs` table + `log_admin_action` | `0010`, `0151` |
| Order timeline | `order_events` | `0173` |
| Error tracking (APM) | **None found** (no Sentry/Datadog/etc.) | — |
| Structured logging | **None** — only `console.error` in 2 error boundaries | `error.tsx` |
| Request IDs / trace context | **None** | — |
| Uptime monitoring | **None found** | — |
| DB monitoring | Supabase dashboard (manual) | — |
| Alerting | **None found** | — |
| Notification-delivery logs | fire-and-forget web-push, no delivery log | `lib/push.ts` |

## Findings
| ID | Title | Severity |
|---|---|---|
| OPS-01 | No application error tracking (APM) — production exceptions are invisible unless a user reports them | **High (operational)** |
| OPS-02 | No structured logging / request IDs / user-store context in logs | Medium |
| OPS-03 | No alerting on error rate, p95, DB connections, failed orders/bookings | Medium |
| OPS-04 | No uptime/synthetic monitoring on critical routes (checkout, login) | Medium |
| OPS-05 | Push/notification delivery is fire-and-forget with no success/failure record | Low |

## Recommended (Checkpoint 3+)
1. **Add an error tracker** (Sentry or equivalent) wired into both `error.tsx` boundaries + server RPCs' client-side error handlers. Highest operational ROI — today a 500 spike is undetectable.
2. **Alerts** (once metrics exist): error rate ↑, p95 ↑, DB connection saturation, DB CPU, failed order/booking rate, duplicate-booking conflicts (would have surfaced CID-01 in the wild), 401/403/429/500 rate, public-form spam (stay/ticket — CID-02/03).
3. **Structured logs** with request ID + `store_id`/`user_id` context (never log phone/PII/secrets).
4. **Uptime checks** on `/`, `/[store]`, checkout RPC, login.

## Production-readiness dashboard (spec)
Panels: RPS + error rate (by route class) · p50/p95/p99 latency · DB active/waiting connections · DB CPU/mem · slow-query count · orders/bookings created vs failed · realtime channel count · push delivery success · storage bandwidth · top 429/500 routes.
