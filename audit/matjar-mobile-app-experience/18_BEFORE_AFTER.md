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

## Root cause, pinned down (Batch 2)

Not just "screenshots time out". Probing the DOM directly shows that page-level
content in this pane stays inside its React streaming boundary — the wrapper
div `id="S:1"` keeps `display:none` and the nodes inside it never hydrate
(`Object.keys(el)` carries no `__react*` fiber key).

Consequences, stated plainly:

| Layer | Measurable here | Why |
|---|---|---|
| Layout chrome (bottom nav, header) | **yes** — real geometry and clicks | rendered outside the boundary |
| Page content (filters, cards, sheets) | **structure only** | inside `S:1`, never revealed, never hydrated |

So for page-level work this session can verify: the right classes on the right
nodes, the mobile/desktop split, typecheck, lint, tests and build. It cannot
verify: does the sheet open, does focus move into it, does Escape close it.
Those are written to be correct and are listed as **needing one pass on a real
device** rather than reported as passing.
