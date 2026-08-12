# 19 — Remaining issues after Batch 0

Everything in `MOBILE_ISSUES.csv` is open — Batch 0 changed no application code.

## Decisions that need the product owner, not the designer
1. **Does `/market` (classifieds) lose its tab?** The proposal folds it into Explore as a segment to free a slot for طلباتي. If classifieds are strategically central, the trade-off changes.
2. **Activity badge semantics** — count everything open, or only items awaiting the customer? Proposal: only awaiting.
3. **PWA install prompt timing** — on first visit, or after a first successful transaction? Proposal: after, so the prompt lands when the app has earned it.

## Data prerequisites that block features
| Feature | Blocked by |
|---|---|
| "الأقرب إليك" on home | 10 of 11 active stores have no coordinates |
| Profit / margin surfaces | 0 of 46 products carry a cost price |
| Crafts discovery | 0 live craft providers |

These are content gaps, not code gaps. Building the UI first would ship convincing-looking empty screens.
