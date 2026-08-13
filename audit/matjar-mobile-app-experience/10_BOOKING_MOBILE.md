# 10 — Booking (mobile)

Existing engine: `booking-panel.tsx` (889 lines), `place_booking`, provider availability rules and exceptions, waitlist, cancellation window (`booking_cancel_hours`).

## Target flow
`الخدمة → مقدّم الخدمة → التاريخ → الوقت → التفاصيل → المراجعة → التأكيد`

Step-based, not one long form. At every step the customer can see: which service, with whom, when, price, and **whether this is a request or a confirmation** — the single most common booking confusion.

Date and time selection move into bottom sheets sized for thumbs; the current inline grid is dense at 375px.

Cancellation policy must appear **before** the confirm button, not after booking.

Hospitality (`stay_bookings`) keeps its own date-range flow — never the hourly appointment UI.
