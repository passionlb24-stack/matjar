# 19 — Pilot Selection

## I recommended the wrong sector at Checkpoint 0, and the data says so

At Checkpoint 0 I recommended **Beauty** as the pilot, on product grounds: it exercises
gallery, team, portfolio, availability and packages at once, with no clinical or legal
complexity. That reasoning was sound and the recommendation was wrong, because I had not
queried merchant distribution per sector.

**Matjar has zero beauty merchants.** Not few — none.

## The actual distribution of live merchants

| Sector | Stores | Products | Orders | Bookings | Providers | Covers | Map pins |
|---|---|---|---|---|---|---|---|
| **retail** | **7** | **30** | **5** | 0 | 0 | **7** | 4 |
| healthcare | 2 | 6 | 0 | 3 | **0** | 2 | 0 |
| services | 2 | 2 | 0 | 0 | 0 | 1 | 1 |
| food | 1 | 3 | 0 | 0 | 0 | 1 | 0 |
| professional | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| **all other 12 sectors** | **0** | — | — | — | — | — | — |

Beauty, fitness, education, events, hospitality, real estate, automotive, pharmacy, pet
care, contractors, farm, sports courts: **no merchant has ever signed up.**

## Scoring against the brief's criteria

| Criterion | retail | healthcare | food | services | professional |
|---|---|---|---|---|---|
| Real merchant data to render | **7 stores, 30 products** | 2 stores, 6 products | 1 store | 2 stores | 1 store, nothing in it |
| Transaction readiness | **orders work, 5 real** | bookings work, 3 real | order engine, 0 used | none used | none |
| Can demonstrate Team | no | **should** — but 0 doctors exist | no | no | no |
| Can demonstrate Gallery | 7 covers | 2 covers | 1 cover | 1 cover | none |
| Can demonstrate Portfolio | no | no | no | possible, 0 rows | possible, 0 rows |
| Reviews with provenance | 1 real | 1 real | 0 | 0 | 0 |
| Technical risk | **lowest** | low | low | low | low |
| Proves verticalisation | **weakest** | strongest | strong | medium | medium |

## Decision: retail

Not because it is the most interesting — it is the least. Because **Definition of Done #1 is
"real merchant data renders correctly" and #24 is "no fabricated data is visible."** Every
other candidate would require inventing a salon or a clinic roster to have anything to show,
and inventing merchants is the exact failure this entire audit exists to name.

Retail also happens to be where the remaining money bugs live: it is the only sector with
real orders.

## The honest cost of that decision

A retail pilot **cannot** demonstrate team profiles, portfolio, availability or booking
depth. It will prove the engine — profile composition, gallery, offering depth, reviews with
provenance, the order transaction end to end, the activity centre, merchant operations — and
it will not prove verticalisation, because retail is the generic case the engine falls back
to.

That is a real limitation and it should not be dressed up. The engine's sector-awareness is
proven by `profile-order.test.ts` at the resolver level, not by the pilot.

## Second wave: healthcare, and it is nearly free

Healthcare has **2 active clinics and 3 real bookings** — and **zero `doctors` rows**. The
team module, the single thing that makes a clinic page a clinic page, has no data in it.

Adding doctors to two existing clinics is a content task measured in minutes, not an
engineering one. It converts healthcare from "cannot demonstrate team" to "the strongest
verticalisation proof on the platform," and it is the highest-leverage non-code action
available right now.

**Recommended sequence:** pilot retail → owner adds doctors to the two clinics → healthcare
as the verticalisation proof, on real data.
