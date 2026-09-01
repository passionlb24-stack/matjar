// The shared presentational layer for the professional profile engine.
//
// The data contract lives in src/lib/professional.ts; this folder is the only
// place that decides what any of it LOOKS like, so crafts and freelance cannot
// drift into showing the same fact two different ways.
//
// The one rule every component here keeps: a block with no data renders
// nothing — not a zero, not a placeholder, not an "add this" box on a page a
// customer is reading. Import by name from "@/components/professional".
//
// ===== Laying results out in a grid =====
//
// `ProfessionalCard` truncates a long name, which means its max-content width
// is the FULL untruncated name. A grid track that sizes to content will take
// that width and overflow the page:
//
//   <div className="grid gap-4 sm:grid-cols-2">        ← WRONG below `sm`
//
// Below `sm` there is no `grid-cols-*` in play, so the implicit track is `auto`
// = max-content, and a card carrying a long business name measured 544px of
// content inside a 360px viewport — a horizontally scrolling page. Always name
// the mobile column count so every track is `minmax(0, 1fr)`:
//
//   <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
//
// The cards carry `min-w-0` themselves, which covers a flex parent, but nothing
// inside a grid item can fix a track that was sized to content.

export { ProfessionalIdentity } from "./professional-identity";
export { ProfessionalTrustBadges } from "./professional-trust-badges";
export { ProfessionalAbout } from "./professional-about";
export { ProfessionalServices } from "./professional-services";
export { ProfessionalPortfolio } from "./professional-portfolio";
export { ProfessionalSkills } from "./professional-skills";
export { ProfessionalExperience } from "./professional-experience";
export { ProfessionalReviews } from "./professional-reviews";
export { ProfessionalServiceArea } from "./professional-service-area";
export { ProfessionalAvailability } from "./professional-availability";
export { ProfessionalCard } from "./professional-card";
export { ProfessionalCompleteness } from "./professional-completeness";
export { ProfessionalStickyCta } from "./professional-sticky-cta";
export type { ProfessionalDict } from "./copy";
