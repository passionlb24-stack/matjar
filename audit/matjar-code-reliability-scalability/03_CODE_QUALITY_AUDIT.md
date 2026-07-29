# 03 — Static Code Quality Audit

_Checkpoint 0. Commands run (read-only): `npx tsc --noEmit`, `npx vitest run`, `npx eslint .`, `next build`, targeted greps._

## Command results
| Command | Result |
|---|---|
| `tsc --noEmit` | **Clean** (0 errors) |
| `vitest run` | **43 passed / 43** (8 test files) |
| `next build` | **Success** |
| `eslint .` | **22 problems: 14 errors, 8 warnings** (all React-19 hook rules + unused vars — no correctness bugs) |

## Verdict: unusually clean
`: any` = **0** · `as any` = **0** · `@ts-ignore`/`@ts-expect-error` = **0** · stray `console.log` = **0** · empty business catches = **0** · TODO/FIXME/HACK = **0** · floating promises = **0** · leaked secrets = **0**. This is a high-discipline codebase; the findings are maintainability smells, not bugs.

## Findings
| ID | Title | Severity | Evidence |
|---|---|---|---|
| CQ-01 | Untyped Supabase clients → 304 `as` casts, **113 `as unknown as X[]` double-casts** defeating type-checking | Medium | `client.ts:6`, `server.ts:10` create clients with **no `<Database>` generic**; no `database.types.ts` exists. Top: `automation-manager.tsx` (30), `store/[id]/page.tsx` (12) |
| CQ-02 | Hardcoded sector/category slugs bypass the central registry (multiple source of truth) | Medium | `store/[id]/page.tsx:493`, `merchant/[storeId]/page.tsx:740`, `product/[id]/page.tsx:365`, `items/page.tsx:226`, `product-form.tsx:59,70`, `home.ts:12` |
| CQ-03 | 14 ESLint errors — React-19 `react-hooks/set-state-in-effect` (×7) + `react-hooks/purity` (×6) | Low | `theme-toggle.tsx:17`, `timeslot-booking.tsx:86`, `count-up.tsx:30`, `explore-client.tsx:119` |
| CQ-04 | Duplicated price/total logic in TS and in the order RPCs | Low | `product-order.tsx:121`, `pos-terminal.tsx:98` vs order RPCs — server is authoritative (display-only in TS), but two sources of the formula |
| CQ-05 | 8 ESLint unused-var warnings | Low | `timeslot-booking.tsx:71`, `verifications-manager.tsx:64` |

### CQ-01 (Medium) — highest-ROI fix
Clients are created without the generated `Database` generic, so every query result is untyped and force-cast — 113 of them via `as unknown as`, which erases all type safety on money/ID fields. A column rename or type drift is invisible to `tsc`. **Fix:** `supabase gen types typescript` → `createBrowserClient<Database>(…)`; ~113 casts delete themselves and query typos become compile errors. (Checkpoint 3 — additive, no runtime change.)

### CQ-02 (Medium) — registry bypass
A config-driven registry exists (`sectors.ts` `sectorConfig`, `store-experience.ts` `resolveStoreExperience`) yet hot paths branch on raw slugs (`category === "food"`, `=== "services" || === "healthcare"`). Some lines mix both in one expression (`sectorHasTeam(category) || category === "services"`), direct evidence the registry is incomplete/bypassed. **Fix:** add capability flags (`allowScheduling`, `useVariantMatrix`, `hasTeam`) to `sectorConfig`/`resolveStoreExperience` so a new sector is a one-file change.

## Correct-by-design (informational)
- console: only `console.error` in the two error boundaries.
- Silent catches: only theme-init boot script + Capacitor fail-safes.
- Secrets: server secrets from env; `config.ts` fallback is a **public-by-design** anon key (RLS-protected). ⚠️ never let a `service_role` key use that fallback pattern.
- i18n parity: ar.json/en.json key sets identical (3082/3082, verified).
