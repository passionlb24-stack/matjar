# 04 — Merchant app shell

## Current
A 48px sticky strip + full-screen drawer (`merchant-sidebar.tsx:295`). Every operational move costs: open drawer → find item → tap.

## Target
A merchant bottom bar, sector-aware, rendered only under `/merchant/[storeId]/*` and only below `lg`.

```
الرئيسية · العمليات · الكتالوج · التقارير · المزيد
```

- Tabs 2 and 3 resolve from the store's sector (see doc 02).
- **المزيد** opens the existing drawer — the drawer is not deleted, it is demoted from primary navigation to overflow. Nothing becomes unreachable.
- Badge on العمليات = count of items in the actionable state (`orders.status = 'pending'`, or the sector equivalent). Real query only.
- Staff permissions already gate modules (`canAccess`) — the tab bar must respect the same gate, so a staff member without `orders` never sees العمليات.

## Merchant home priority
Answer one question: *what needs me right now?*

1. Action counters (new orders, today's bookings, low stock) — each tappable, each a real count
2. Today's list
3. Setup gaps (existing `StoreChecklist`)
4. Numbers
5. Quick actions

The existing sector-aware `WIDGET_ORDER` already encodes most of this and is **kept** — the change is density and tap size on a phone, not the ordering logic.

## Operational tables → cards
`orders-filter.tsx` already renders cards, and the work layer is already folded behind إدارة الطلب. Remaining table-like surfaces to convert: inventory list, CRM list, suppliers.
