# 17 — E2E results

**Batch 0 ran no end-to-end flows.** Nothing was implemented, so there is nothing to regress.

Baseline recorded on branch `feat/mobile-app-experience`:

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run lint` | 0 errors, 9 known warnings |
| `npx vitest run` | 17 files, 154 tests passed |
| `npx next build` | compiled successfully |

Route probes at 375×812 (Arabic):

| Route | H-overflow | Targets <44px | Text <12px |
|---|---|---|---|
| `/ar` | none | 4 | 4 |
| `/ar/explore` | none | 4 | 0 |

E2E flows from §47/§48 will be executed per batch as the surfaces they touch are implemented. Flows for categories without live data (hospitality, automotive) will be reported as **unsupported**, not as passed.
