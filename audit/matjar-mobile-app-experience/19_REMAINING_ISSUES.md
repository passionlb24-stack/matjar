# 19 — Remaining issues after Batch 0

**Status: 16 fixed, 1 partial, 2 deferred, 1 open.**

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
| M-011 | Cart sheet with reachable steppers |
| M-013 | Confirmation screen stating the amount and what happens next |
| M-014 | Booking step flow with date/time sheets, the request-vs-confirmation statement and the cancellation window before the button |
| M-015 | Inventory rows readable at 360px (and the audit's "desktop table" premise corrected) |
| M-016 | CRM rows readable at 360px (same correction) |
| M-018 | `ui/bottom-sheet` with focus trap |
| M-019 | Phone home leads with categories and shops; merchant pitch last; thin rails hidden |

**M-010 is partial**: 192 is now declared, but it points at the same 512 asset and there is still no `apple-icon`. Real assets at real sizes are a design task, not a code one.

**Still open:** M-020 only — store coordinates, which is content the owner enters, not code.

### The audit was wrong about M-015 and M-016

Both rows said these screens "render a desktop table on phones". Neither file
contains a `<table>`; both already rendered flex rows. The rows were corrected
in the CSV rather than quietly closed, the same way M-006 was handled when a
measured finding turned out to be a false positive.

The real defect was different and still real: unwrapped flex rows with
`shrink-0` siblings, so the only element that could give way was the one with
`min-w-0` — the name. At 360px the customer name was down to roughly 40px while
every button beside it kept its full width.

### Known accessibility tradeoff on the phone home page

The mobile sequence comes from CSS `order`, so the DOM order stays desktop
order and a screen reader on a phone reads the old sequence. The alternative —
reordering the JSX and restoring desktop with `lg:order-*` — moves the same
mismatch onto desktop, where keyboard navigation is far more common. Neither
option is free; this is the one that also honours "desktop must not change".
Removing the mismatch entirely means agreeing to one section order for both,
which is a product decision, not a design one.

**Deferred:** M-012 (staged checkout) and M-017 (splitting the store-products bundle) — both want the same file restructured, and neither is worth a second pass through checkout on its own.

## Decisions that need the product owner, not the designer
1. **Does `/market` (classifieds) lose its tab?** The proposal folds it into Explore as a segment to free a slot for طلباتي. If classifieds are strategically central, the trade-off changes.
2. **Activity badge semantics** — count everything open, or only items awaiting the customer? Proposal: only awaiting.
3. **PWA install prompt timing** — on first visit, or after a first successful transaction? Proposal: after, so the prompt lands when the app has earned it.

## Data prerequisites that block features
| Feature | Blocked by |
|---|---|
| "الأقرب إليك" on home | 8 of 11 active stores have no coordinates (3 now do, up from 1). All 11 are in the north — Matjar is a Tripoli/north marketplace today, not a national one, and the filters and copy should probably say so. |
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
