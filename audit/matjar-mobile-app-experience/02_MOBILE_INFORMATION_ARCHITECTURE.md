# 02 — Mobile information architecture

Two products, one design system, two navigation models.

## Customer IA

```
الرئيسية        home — location, search entry, categories, discovery
استكشف          explore/discover — browse + filter + map
طلباتي          ACTIVITY (new) — every transaction the customer created
المفضلة         saved stores, products, listings
حسابي           profile, addresses, settings, support
```

### Why activity earns a tab
Matjar creates six kinds of customer transaction. A marketplace where the customer cannot answer "where is my thing?" in one tap is a catalogue, not a marketplace.

### Activity centre sections
Filters inside one screen — **not** merged into one meaningless list:

```
الكل · الطلبات · الحجوزات · طلبات الخدمات · الاستفسارات
```

Each card must state its **type** explicitly, because "قيد التحضير" means something different for a food order and a service request.

| Type | Source | Status vocabulary |
|---|---|---|
| طلب | `orders` | pending → accepted → preparing → ready → out_for_delivery → completed |
| حجز | `bookings` | بانتظار التأكيد → مؤكد → مكتمل → ملغى |
| طلب خدمة | `craft_requests` | pending → accepted → in_progress → completed |
| استفسار | `leads` | new → contacted → closed |

Existing status vocabularies are reused verbatim. **No new statuses invented.**

## Merchant IA

Derived from the **existing** `OS_MODULE_META` + sector config in `src/lib/sectors.ts` — not a second app per sector.

```
الرئيسية    what needs attention now
العمليات    the sector's primary inbox  (orders | bookings | requests | leads)
الكتالوج    products | services | units | listings
التقارير    money and trend
المزيد      everything else, grouped
```

Tab 2 and 3 resolve from the sector's own module list:

| Sector | Operations tab | Catalog tab |
|---|---|---|
| food | الطلبات | القائمة |
| retail / pharmacy / farm | الطلبات | المنتجات |
| healthcare | المواعيد | الخدمات |
| services / contractors | الطلبات | الخدمات |
| hospitality | الحجوزات | الوحدات |
| realestate | الـLeads | العقارات |

Fallback when a sector defines neither: الرئيسية · المزيد only. No empty tab is ever rendered.
