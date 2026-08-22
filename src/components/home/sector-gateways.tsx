import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { CategoryKey, GroupKey } from "@/lib/catalog";
import { sectorConfig } from "@/lib/sectors";
import { Container } from "@/components/ui/container";

// The four doors, directly under the location row and the header's search box.
//
// This is the one structural claim the Home redesign makes: a customer who
// wants lunch and a customer who wants a doctor are not browsing the same
// marketplace, and until now they both had to read a nine-tile category rail
// (WorldsShowcase, below) to find that out. Four sectors carry almost all of
// the buying intent this platform actually serves, so they get a first-class
// row above everything else — and the nine-tile rail stays exactly where it
// was for everyone whose errand is not one of these four.
//
// Each tile lands on /explore pre-filtered by GROUP, not by sector. That is
// deliberate and it is the honest mapping:
//
//   food      → group "food"      = the food sector alone
//   health    → group "health"    = healthcare + beauty + petCare + pharmacy
//   shopping  → group "shopping"  = retail + farm
//   services  → group "services"  = services + contractors + professional
//
// `تسوّق` and `خدمات` are not single sectors — a hardware shop, a plumber and
// an accountant are three different `business_types` rows — so pinning either
// tile to one CategoryKey would hide the rest of the door behind it. `?group=`
// is a filter /explore has parsed since it shipped (parseDiscoveryQuery in
// lib/discovery, same contract WorldsShowcase links against), so none of these
// four is a new route: they are four existing, already-indexed views.
//
// Colour: `sectorConfig[…].iconTint` — the `bg-tint-N-soft text-tint-N` pair
// from the seven-slot ramp in globals.css. Those tokens are redefined under
// both `prefers-color-scheme: dark` AND `[data-theme="dark"]`, so the tiles
// follow the theme toggle as well as the OS. Hard-coding the light hexes here
// would have shipped a light-only palette, and Tailwind's `dark:` variant
// cannot be used for the same reason it is used nowhere else in this codebase:
// this project has no `@custom-variant dark`, so `dark:` compiles to a bare
// prefers-color-scheme query that the explicit theme toggle cannot override.
const GATEWAYS: {
  /** dict.home.gateways.* */
  key: "food" | "health" | "shopping" | "services";
  /** Sector the tile borrows its identity colour and icon from. */
  face: CategoryKey;
  /** The /explore group behind the door. */
  group: GroupKey;
}[] = [
  { key: "food", face: "food", group: "food" },
  { key: "health", face: "healthcare", group: "health" },
  { key: "shopping", face: "retail", group: "shopping" },
  { key: "services", face: "services", group: "services" },
];

export function SectorGateways({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Pick<Dictionary, "home">;
}) {
  const t = dict.home.gateways;

  return (
    <section className="pt-3 lg:pt-6">
      <Container>
        <nav
          aria-label={t.label}
          className="grid grid-cols-4 gap-2 sm:gap-3"
        >
          {GATEWAYS.map(({ key, face, group }) => {
            const { Icon, iconTint } = sectorConfig[face];
            return (
              <Link
                key={key}
                href={`/${lang}/explore?group=${group}`}
                // min-h-20 = 80px. Well past the 44px floor even at 320px,
                // where four columns and two gaps leave each tile 64px wide and
                // the label takes two lines.
                className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-3 text-center transition-transform hover:-translate-y-0.5 sm:px-2 ${iconTint}`}
              >
                <Icon aria-hidden className="h-6 w-6 shrink-0" />
                <span className="text-xs font-bold leading-tight sm:text-sm">
                  {t[key]}
                </span>
              </Link>
            );
          })}
        </nav>
      </Container>
    </section>
  );
}
