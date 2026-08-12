# 07 — Search & filters (mobile)

## Search
Today: a 210px header input. Target: header shows a **search entry button**; tapping opens a full-screen search screen.

Screen contents: back · input (autofocus, correct `inputMode`) · recent searches (local) · popular searches **only if backed by `search_logs`** · results grouped by type (متاجر / منتجات / خدمات).

States: idle (recents) · typing (debounced) · loading (skeleton rows) · empty (suggest categories) · error (retry).

Existing `search_products_fuzzy` and `normalize_search` (harakat-stripping, word-start matching) are reused — no new search backend.

## Filters
Replace the wrapped chip wall with:
- a sticky bar under the header: `فلترة` (opens sheet, shows active count) + `ترتيب` + the 2–3 most-used chips inline
- a bottom sheet holding the rest, with **تطبيق** and **مسح الكل**

### Sector-appropriate filters only
| Sector | Filters |
|---|---|
| retail / market | category, region, price, rating, open now |
| food | region, open now, delivery, rating |
| healthcare | specialty, region, insurance, availability |
| realestate | type, region, price, rooms, area |
| automotive | make, year, price, mileage |

A restaurant must never be filtered by "عدد الغرف".
