# 05 — Mobile design system

**No second identity.** Everything below extends `globals.css`.

## Already in place
- Colour tokens with light/dark values, AA-checked semantic pairs (`--success` / `--success-soft` / `--success-strong`)
- Type scale: `.text-display` / `.text-h1`–`.text-h4` / `.text-body` / `.text-caption` / `.text-label`, leading tuned for Arabic
- `.text-money` — tabular numerals, isolated LTR
- Shadows `xs`–`xl`, `--ease-out-back`, `.animate-rise`, `.animate-pop`, global reduced-motion guard
- `ui/`: Button, Card, Badge, Field, EmptyState, Skeleton, Tabs, Progress, Stat, Sparkline, ConfirmDialog, Container, PageHeader, PageHero

## To add

### Mobile spacing tokens
As listed in doc 03.

### Components
| Component | Why |
|---|---|
| `BottomSheet` | filters, sort, variants, modifiers, transaction actions. Focus trap, `Esc`, backdrop dismiss, drag handle, `role="dialog"` + `aria-modal` |
| `ChipRail` | horizontally scrolling, snap-aligned chip row; replaces `flex-wrap` chip walls |
| `SegmentedControl` | activity type filter, fulfilment choice |
| `MobileSearchScreen` | full-screen search with recents |
| `ActivityCard` | one card, four type variants |
| `StickyActionBar` | standard offsets above the tab bar, safe-area aware |

### Card specifications
Store card answers: *what is this business and why open it?* → image, name, verified, category, area, open/closed, rating **only when real**.
Offering card varies by sector (retail / food / service / property / vehicle) — one component, sector variants, never one universal card carrying irrelevant fields.

## Touch target rule
44×44 minimum. Where the visible control must stay small, extend the hit area with a transparent pseudo-element — the pattern `ui/button` already uses for `size="sm"`.
