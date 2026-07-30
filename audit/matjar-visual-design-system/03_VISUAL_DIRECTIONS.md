# 03 — Visual Directions & Recommendation

The measurements settled most questions. This one they can't: **what should Matjar feel like?** That is a positioning decision, and it is genuinely open.

An important constraint from the inventory: the existing identity is already committed — Matjar blue `#1556c2`, warm off-white ground `#fbfbf9`, amber accent, Tajawal + Alexandria. **None of the directions below change the logo or the brand hue.** They differ in how that identity is *applied*: density, elevation, how much the marketplace and the Business OS resemble each other.

---

## Direction A — Trusted Local Marketplace

**Concept.** Matjar is the place you find a real shop near you. The interface gets out of the way of photographs and shop names. It should feel like a well-organised Lebanese street, not a SaaS console.

**Mood.** Warm, open, unintimidating. A shopkeeper with no computer skills should not feel this was built for someone else.

**Colour.** Lean on the existing warm off-white ground. Blue reserved for actions only — never decoration. Amber for offers and ratings, used sparingly enough that it still signals. Large neutral areas; colour earns its place.

**Typography.** Alexandria at generous display sizes for store and product names — the name is the hero. Tajawal body at comfortable reading size (16px floor, not 14px).

**Cards.** Photograph-forward, generous radius, soft `shadow-sm`, minimal chrome. The image is most of the card.

**Buttons.** Solid primary, full-width on mobile, ≥48px. One obvious action per screen.

**Navigation.** Simple and shallow. Search prominent. Categories visual (icon + name), not a text list.

**Dashboard.** Same visual language as the storefront, just denser. Merchants never feel they crossed into a different product.

**Strengths.** Lowest risk — closest to what exists. Best for non-technical merchants and first-time customers. Fastest to reach.
**Weaknesses.** Reads "small business directory" to an investor or an institution. The Business OS looks less capable than it is.
**Best for.** Customers, small merchants.
**Complexity.** Low — mostly spacing, type-scale, and card refinement.

**Representative pages.** Homepage: big search, visual category grid, nearby stores. Store page: full-width cover, name + trust row, product grid, sticky mobile action. Product page: large gallery, price, single CTA.

---

## Direction B — Premium Business Platform

**Concept.** Matjar is infrastructure Lebanese businesses run on. The interface signals competence and permanence — the kind of thing a bank or a ministry would accept as a serious counterparty.

**Mood.** Composed, precise, quietly confident. Restraint over enthusiasm.

**Colour.** Cooler, tighter neutral ramp. Blue deeper and more structural — used in headers and key surfaces, not only buttons. Amber demoted to data highlight. Near-monochrome overall with colour as pure signal.

**Typography.** Tighter type scale, more weight contrast, less size contrast. Alexandria smaller and more controlled. Numerals get `tabular-nums` everywhere — prices, reports, tables align to the digit.

**Cards.** Squarer corners, hairline borders instead of shadows. Elevation only for genuinely floating things (modals, menus). Flatter, more document-like.

**Buttons.** More restrained. Clear primary/secondary/tertiary hierarchy. Destructive actions visually distinct and deliberate.

**Navigation.** Structured, hierarchical. Breadcrumbs on inner pages. Persistent dashboard sidebar with grouped sections.

**Dashboard.** The centre of gravity. Dense tables, strong filtering, reports that look like reports.

**Strengths.** Reads credible to companies, investors, public-sector buyers. Suits the Business OS positioning. Ages well.
**Weaknesses.** Can feel cold on the consumer side; risks making a corner grocery's storefront look like a banking portal. Hardest to keep warm in Arabic at small sizes.
**Best for.** Companies, institutions, investors.
**Complexity.** Medium-high — a real shift in elevation and density language.

**Representative pages.** Merchant dashboard: action-first ("3 orders awaiting confirmation"), then state, then performance. Reports: dense table, sticky header, tabular numerals, export. Admin stores: filterable table, status chips, guarded destructive actions.

---

## Direction C — Modern Commerce Operating System

**Concept.** Two products, one system. The marketplace is warm and visual; the Business OS is efficient and dense. They share tokens, type, status colours, and interaction patterns — but not density. The connection between them is the product.

**Mood.** Modular and purposeful. Every surface obviously belongs to Matjar, but each is shaped for its job.

**Colour.** One token set, two applications. Storefront: generous whitespace, colour on imagery and actions. Dashboard: same palette, compressed — colour carries state (pending / confirmed / cancelled) rather than decoration. **Status colours identical across both**, so `success` means the same thing everywhere.

**Typography.** One scale, two densities. Storefront uses the upper range; dashboard uses the lower with tighter line-height. Same faces, same weights, same ratios.

**Cards.** Two documented variants: `display` (marketplace — image-forward, elevated) and `data` (dashboard — bordered, compact, scannable). Both from one `Card` primitive, not two components.

**Buttons.** Identical primitives; the dashboard defaults to `sm`, the storefront to `md`/`lg`.

**Navigation.** Storefront: horizontal, discovery-led. Dashboard: sidebar, task-led. Shared header shell so identity persists.

**Strengths.** Matches what Matjar actually is — the sector registry and module system already work this way. Solves the real measured problem (dashboard drift) directly. Scales as sectors are added.
**Weaknesses.** Demands discipline: two densities must be *documented*, or they degrade into inconsistency — which is precisely the 212-instance debt today. Needs the missing primitives (Table, Toast, Modal) built first.
**Best for.** All three audiences, each on its own surface.
**Complexity.** Medium — mostly formalising and enforcing what already half-exists.

**Representative pages.** Homepage: warm, visual, customer-first, with one clear merchant entry point. Merchant dashboard: same brand, denser grid, next-actions above statistics. Store page: storefront theme applied, marketplace chrome around it.

---

## Recommendation — **Direction C**, borrowing from A and B

**Take C as the frame.** It is the only direction that addresses the defect the measurements actually found. The problem is not that the marketplace looks wrong — it measures clean. The problem is that **the dashboard drifted off the system** (212 hardcoded colours, overwhelmingly under `(dashboard)/`). C names that as the core design problem and gives it a structure: one token set, two documented densities.

**Borrow A's warmth for everything customer-facing.** Matjar's edge in Lebanon is that a shop owner with no technical skill can use it. B's coolness would cost that, and the warm off-white ground is already a genuine asset — keep it.

**Borrow B's rigour for tables, reports, and admin.** Tabular numerals, hairline borders over shadows, guarded destructive actions. These are where B is simply correct, and they are exactly the surfaces that drifted.

**Reject wholesale B.** Repositioning the consumer marketplace as institutional software would trade Matjar's real advantage for a perception gain it doesn't yet need.

### Why not A alone
A is lowest-risk and would leave the storefront in good shape — but it has nothing to say about the dashboard, which is where the measured debt is and where the differentiator lives.

### What C requires before it can be applied
1. Build the missing primitives — **Table, Toast, Modal/Drawer, Pagination** — since their absence is what forced the ad-hoc markup carrying the 212 colours.
2. Document the two density modes explicitly (spacing scale, type sizes, card variant per context). Undocumented, this direction *becomes* the inconsistency it's meant to fix.
3. Convert `(dashboard)/` files to tokens using the 212-instance list as the worklist.

### On avoiding generic AI design
The brief warns against gradient heroes, glassmorphism, purple glow, floating shapes. **The measurements show none of these are present.** The palette is a considered warm-neutral with a single brand blue and an amber accent; shadows are tuned, layered, and ink-tinted rather than generic black. No direction above introduces them, and none should.

The one real risk in this territory is the opposite failure: adding decoration to make the dashboard "look designed." The dashboard's job is to tell a merchant what needs attention right now. Density and clarity are the design.
