# 16 — Accessibility & RTL

## Present
- `:focus-visible` outline, element-qualified so it beats `outline-none` utilities
- `aria-current="page"` on the tab bar
- `aria-busy` on loading buttons
- global `prefers-reduced-motion` guard
- `aria-live="polite"` on the cart count
- logical properties (`ms-`, `me-`, `start-`, `end-`) used throughout
- `rtl:rotate-180` on directional chevrons

## To fix
| Issue | Where |
|---|---|
| 4 tap targets under 44px | global header |
| 9–10px text | home app-download badges |
| Bottom sheet a11y | component does not exist yet — must ship with focus trap, `aria-modal`, Esc, restore focus |
| Tab bar labels | present, keep — icon-only tabs fail for first-time users |

## RTL checklist for every batch
bottom nav order · chevron direction · carousel/rail scroll direction · tabs · back navigation · sticky CTA side · bottom sheet drag · form alignment · timeline direction · number and currency isolation (`.text-money` handles this).
