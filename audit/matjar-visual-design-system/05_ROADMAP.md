# 05 — Implementation Roadmap

Sequenced by measured impact, not by page order. Nothing here has been implemented — Checkpoint 0 is audit only.

---

## Batch 0 — Accessibility defects (P0)

The only findings that block real users today. Small, safe, independently shippable.

| Item | File | Effort |
|---|---|---|
| Footer link tap targets → ≥44px | `site-footer.tsx:113` | XS |
| 7 unlabelled inputs on `/ar/market` | `(site)/market/page.tsx` | S |
| Search input accessible name | search component | XS |
| Header icon buttons → 44px hit area | `site-header.tsx`, `theme-toggle.tsx` | S |

**Acceptance:** re-run the audit harness — `tapFails` drops from 29–34 to under 5 per page; `inputsNoLabel` reaches 0 on all public routes.
**Risk:** very low. Padding and attributes only; no layout restructuring.
**Note:** MJ-D01 and MJ-D05 are one-line changes with platform-wide effect. There is no reason to defer them behind a design decision.

---

## Batch 1 — Missing primitives

Prerequisite for Batch 2. The absence of these is what forced the ad-hoc markup carrying the 212 hardcoded colours — converting pages before the primitives exist would just re-hardcode them.

Build, in order of leverage: **Table** (with sticky header, tabular numerals, RTL-correct alignment) → **Toast** → **Modal / Drawer** (extending `confirm-dialog`, with focus trapping) → **Pagination**.

Each specified with variants, sizes, states, RTL behaviour, mobile behaviour, accessibility requirements, and anti-patterns — matching how the existing 14 primitives are documented.

**Acceptance:** each primitive keyboard-navigable, focus-visible, token-only colours, verified in both themes and both languages.

---

## Batch 2 — Dashboard token convergence

The core work. Use the MJ-D03 offender list as the worklist; convert one file per commit so any regression is bisectable.

Order: `(dashboard)/layout.tsx` (shell, affects everything) → `merchant/page.tsx` (OS home) → `reports` and `accounting` (heaviest tables, benefit most from Batch 1's Table) → `automations`, `campaigns`, `subscription` → the `(site)` stragglers (`bookings`, `delivery`, `offers`, `merchants`, `hub/*`).

**Acceptance:** hardcoded-palette grep count drops from 212 toward 0; every converted page verified in dark mode — these classes are latent dark-mode defects, so conversion is a correctness fix, not only a consistency one.

---

## Batch 3 — Direction C density formalisation

Only after Batches 1–2. Document the two density modes (storefront vs dashboard) as explicit, enforceable rules: spacing scale per context, type sizes per context, which `Card` variant belongs where. Undocumented, Direction C degrades into exactly the inconsistency it exists to fix.

---

## Batch 4 — Coverage gaps

- Run the harness against an **authenticated** session to measure the dashboard and admin surfaces (MJ-D09) — the surfaces with the most hardcoded colour are currently the least verified.
- Capture the current-state screenshot set with the Browser pane displayed (MJ-D10), enabling the composition and hierarchy review the numbers cannot provide.

---

## Visual regression strategy (MJ-D08)

Deferred by Checkpoint 0 rules — it requires adding Playwright, which the brief prohibits at this stage.

Proposed once approved: baselines for ~12 key routes × {390, 1440} × {light, dark} × {ar, en} ≈ 96 snapshots, captured **before** Batch 2 begins so dashboard conversion is protected. Include loading, empty, error, and validation-error states, which need seeded fixtures.

Interim substitute, available now with no new dependency: the **audit harness itself is a regression test**. Contrast failures, tap-target counts, overflow, and unlabelled inputs are all numbers — they can be asserted in CI against thresholds without any screenshot infrastructure. This catches the entire class of defect found in this audit.

---

## Sequencing rationale

Batch 0 ships immediately and independently — it fixes live accessibility failures and needs no design decision. Batches 1–3 depend on approving Direction C. Batch 4 should ideally run *before* Batch 2, so dashboard conversion is guided by measurement rather than static analysis alone.
