# 03 — Customer app shell

## Current
`BottomNav`: 4 tabs — الرئيسية · استكشف · السوق · حسابي. Height 56px, safe-area padded, `lg:hidden`.

## Target
5 tabs. `السوق` (classifieds) moves into Explore as a segment; **طلباتي** takes the freed slot.

| # | Label | Route | Icon | Badge |
|---|---|---|---|---|
| 1 | الرئيسية | `/` | Home | — |
| 2 | استكشف | `/explore` | Compass | — |
| 3 | طلباتي | `/activity` | Receipt | count of items needing attention |
| 4 | المفضلة | `/favorites` | Heart | — |
| 5 | حسابي | `/account` or `/login` | User | — |

### Rules
- Five is the ceiling. A sixth tab makes each ~62px wide at 360px — under the comfortable thumb target.
- Badge counts must come from real queries. **No placeholder numbers.**
- Signed-out: tabs 3 and 4 route to `/login?next=…` rather than disappearing — a moving tab bar is disorienting.
- Active state: colour + weight, no motion (respects reduced-motion by default).
- `aria-current="page"` already implemented — keep.

### Header
Compact, 56px: logo · location chip (when a region is set) · search entry · avatar.
The header **search entry becomes a link to the search screen**, not an input. Reason: a 210px input on a 375px screen invites typing into a field the keyboard then covers.

### Spacing tokens to add
```
--m-page-x: 16px      page gutter
--m-header-h: 56px
--m-tabbar-h: 56px
--m-sticky-gap: 12px  gap between sticky CTA and tab bar
--m-touch: 44px       minimum target
```
