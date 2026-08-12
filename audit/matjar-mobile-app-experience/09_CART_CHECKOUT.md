# 09 — Cart & checkout (mobile)

## Current
Cart and checkout live inside `store-products.tsx`. Checkout was reordered recently: recap first, totals, then questions, with the coupon folded. Fees are shown **before** the final screen — the brief's requirement is already met.

## Remaining mobile work
1. **Cart as a bottom sheet.** Today the cart is a sticky summary bar; the item list is only visible after entering checkout. A sheet showing items + quantity steppers, opened from the bar, is the missing step.
2. **Quantity steppers at 44px.** Current controls are smaller.
3. **Undo instead of instant delete** when a line hits zero.
4. **Staged checkout** on mobile: contact → fulfilment → address → review, with a progress indicator, instead of one long form.
5. **Confirmation screen**: success mark, reference, merchant, summary, current status, what happens next, and three actions — متابعة الطلب · التواصل مع المتجر · العودة للرئيسية.

**Business logic is not to be touched**: `place_customer_order` / `place_guest_order`, idempotency keys, coupon and loyalty capping, zone minimums, stock checks all stay exactly as they are. This is composition only.
