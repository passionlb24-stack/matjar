# 06 — Home & discovery (mobile)

## Current
The mobile home renders the desktop composition: hero, category tiles, store strips, app-download badges (which contain the 9–10px text findings).

## Target order
1. **Location chip** — only when a region is genuinely set; not a fake "near you"
2. **Search entry** — full-width, opens the search screen
3. **Category rail** — horizontal, snap, ~9 items + عرض الكل
4. **Discovery blocks**, each a horizontal rail with a real reason to exist:
   - متاجر مميزة (featured, real `featured_until`)
   - الأقرب إليك — **only rendered when the store has coordinates.** Today 1 of 11 active stores has a map pin, so this block would be near-empty and must be hidden rather than shown thin
   - الأكثر مبيعاً (existing `get_best_sellers`)
   - عروض (only when real offers exist)
5. **For-you strip** — existing `ForYouStrip`, already a client island with zero cost for anonymous users

## Rules
- No section renders with fewer than 3 real items — an empty rail reads as breakage
- App-download badges move below the fold and their type floor rises to 12px
