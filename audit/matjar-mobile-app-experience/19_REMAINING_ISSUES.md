# 19 — Remaining issues after Batch 0

**Status after batches 1, 2, 4, 5 and 6: 10 fixed, 1 partial, 9 open.**

| Closed | What shipped |
|---|---|
| M-001 | Five tabs, طلباتي among them |
| M-002 | `/activity` reading all four transaction tables |
| M-003 | Sector-derived merchant tab bar; drawer demoted to overflow |
| M-004 | Category rail + filter sheet |
| M-005 | Full-screen search with recents |
| M-006 | Header hit areas at 44px (one of the four was a false positive) |
| M-007 | 12px floor for Arabic |
| M-008 | Fetch handler with a narrow, private-safe cache |
| M-009 | Service worker registers for everyone |
| M-018 | `ui/bottom-sheet` with focus trap |

**M-010 is partial**: 192 is now declared, but it points at the same 512 asset and there is still no `apple-icon`. Real assets at real sizes are a design task, not a code one.

**Still open:** M-011 to M-017 (cart sheet, staged checkout, confirmation screen, booking flow, two merchant tables, the store-products bundle split), M-019 (mobile home composition) and M-020 (store coordinates — content, not code).

## Decisions that need the product owner, not the designer
1. **Does `/market` (classifieds) lose its tab?** The proposal folds it into Explore as a segment to free a slot for طلباتي. If classifieds are strategically central, the trade-off changes.
2. **Activity badge semantics** — count everything open, or only items awaiting the customer? Proposal: only awaiting.
3. **PWA install prompt timing** — on first visit, or after a first successful transaction? Proposal: after, so the prompt lands when the app has earned it.

## Data prerequisites that block features
| Feature | Blocked by |
|---|---|
| "الأقرب إليك" on home | 10 of 11 active stores have no coordinates |
| Profit / margin surfaces | 0 of 46 products carry a cost price |
| Crafts discovery | 0 live craft providers |

These are content gaps, not code gaps. Building the UI first would ship convincing-looking empty screens.

---

## Two items deliberately NOT done, with reasons

### M-012 — staged checkout

The obvious implementation is one `<form>` with stages hidden by CSS, so
`FormData` still collects every field and nothing unmounts. That breaks on the
first submit: this form carries five `required` inputs, and a browser asked to
report validity on a `display:none` required control throws *"An invalid form
control is not focusable"* and refuses to submit — silently, from the user’s
point of view.

Doing it properly means moving validation out of the browser and into the
component, which is a real change to the order-submit path. Weighed against
what checkout already does — recap first, fees before the final screen, coupon
folded, data preserved on error — the remaining gain is ordering, and the
remaining risk is orders that do not place. Not a trade worth taking at the
end of a long session on live software.

### M-017 — splitting checkout out of store-products.tsx

Real (1,500 lines of client code on a customer path), but the split means
relocating interdependent state — cart, coupon, loyalty, zones, custom fields,
the idempotency key — across a component boundary on the money path. And the
benefit cannot be measured here: this Next version does not print per-route
First Load JS in the current configuration, so the win would be asserted, not
shown.

Do it when a bundle analyser is wired up and the number is visible, not before.
