# 11 — Customer activity centre

The single biggest addition. New route: `/[lang]/activity`.

## Sources (all existing tables)
| Type | Table | Owner column |
|---|---|---|
| الطلبات | `orders` | `customer_id` |
| الحجوزات | `bookings` | `customer_id` |
| طلبات الخدمات | `craft_requests` | `customer_id` |
| الاستفسارات | `leads` | by phone/user where linked |

## Card anatomy
merchant name · **type label** · date · status pill (type-specific vocabulary) · value · one primary next action.

## Rules
- Type is always stated. Four transaction kinds sharing one status pill is how a customer ends up believing a booking was an order.
- Status vocabularies are reused verbatim from each domain. No invented states, no fabricated tracking steps.
- Empty state per filter: "ما عندك طلبات بعد." + a route into discovery.
- The tab badge counts only items **needing the customer's attention**, not all open items.
