# 15 — Performance

## Measured
Build succeeds in ~7s. Next 16 does not print per-route First Load JS in this configuration, so **no bundle numbers are claimed here** — they will be measured with an analyser in Batch 6 rather than invented.

## Known weight
| Component | Lines | Note |
|---|---|---|
| `store-products.tsx` | 1,540 | client; carries catalogue + cart + checkout together |
| `booking-panel.tsx` | 889 | client |
| `hr-manager.tsx` | 886 | client, merchant-only |
| `automation-manager.tsx` | 825 | client, merchant-only |
| `crm-manager.tsx` | 777 | client, merchant-only |

`store-products.tsx` is the only one on a **customer** path. Splitting checkout out of it is the single highest-value performance change available, and it belongs in Batch 3 where that code is already being touched.

## Already good
- Images via `next/image` with `sizes`
- Leaflet dynamically imported, `ssr: false`
- `unstable_cache` on the heaviest public query (active stores, 60s)
- Aggregation pushed server-side to avoid the PostgREST 1000-row cap

## To measure in Batch 6
LCP, INP, CLS, JS transferred, image bytes — from a real run, documented with the method used.
