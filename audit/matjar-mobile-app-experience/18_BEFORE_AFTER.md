# 18 — Before / after

**No visual changes were made in Batch 0**, so there is no "after" yet.

## On screenshots — honest note
This session's browser pane does not composite frames: `computer{screenshot}` times out after 5s and `IntersectionObserver` callbacks never fire (verified by injecting a bare probe element, not assumed). Pixel captures required by §45 and §51 cannot be produced from this environment.

Substituted evidence, per route and viewport:
- viewport width vs `document.scrollWidth` (horizontal overflow, objective)
- every interactive element under 44px, with measured size
- every text node under 12px, with measured size
- elements intersecting the fixed bottom nav
- sticky/fixed element inventory

These are reproducible and machine-checkable, and they are what generated `MOBILE_ISSUES.csv`. Visual polish, motion feel and colour balance still need a human eye on a real device — that will be requested at each batch checkpoint rather than claimed as verified.
