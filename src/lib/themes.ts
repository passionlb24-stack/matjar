// Storefront themes (migration 0168): five complete design systems, not five
// recolors. Each theme sets DEFAULTS across the whole storefront — accent
// palette, product-list layout, hero anatomy — while the structural DNA
// (cards, buttons, announcement bar, typography) is applied via `[data-sf]`
// CSS in globals.css so it adapts to light/dark automatically.
//
// Override contract (the essential rule): the merchant's own explicit choices
// ALWAYS win over the theme's defaults —
//   accent  = stores.accent_color      ?? theme.accent
//   layout  = stores.storefront_layout ?? theme.layout
// so picking a theme never locks a merchant out of their brand color or their
// preferred product layout.

export type StorefrontTheme =
  | "classic"
  | "minimal"
  | "warm"
  | "bold"
  | "luxe";

export type HeroVariant = "cover" | "slim" | "poster" | "band";

export const THEME_KEYS: StorefrontTheme[] = [
  "classic",
  "minimal",
  "warm",
  "bold",
  "luxe",
];

export const THEMES: Record<
  StorefrontTheme,
  {
    // Default accent hex fed to accentStyle(); null = keep the platform's
    // adaptive blue (used by "minimal", whose controls are monochrome via CSS
    // so prices/links stay readable in both color schemes).
    accent: string | null;
    // Default product presentation; the merchant's storefront_layout wins.
    layout: "grid" | "menu" | "showcase";
    hero: HeroVariant;
    // Swatches for the picker tiles in the edit form (visual identity only).
    swatches: [string, string, string];
  }
> = {
  classic: {
    accent: null, // platform blue, adapts to dark mode
    layout: "grid",
    hero: "cover",
    swatches: ["#1556c2", "#e9f1fd", "#ffffff"],
  },
  minimal: {
    accent: null, // monochrome controls come from [data-sf="minimal"] CSS
    layout: "grid",
    hero: "slim",
    swatches: ["#17181c", "#f4f4f2", "#ffffff"],
  },
  warm: {
    accent: "#e85326", // appetizing coral
    layout: "menu",
    hero: "cover",
    swatches: ["#e85326", "#ffe8d6", "#fff8ee"],
  },
  bold: {
    accent: "#ea4a00", // safety orange — readable as text in both schemes
    layout: "grid",
    hero: "poster",
    swatches: ["#101010", "#d8ff2e", "#f2efe6"],
  },
  luxe: {
    accent: "#a67c28", // antique gold
    layout: "showcase",
    hero: "band",
    swatches: ["#a67c28", "#faf7f0", "#241f18"],
  },
};

export function isStorefrontTheme(v: unknown): v is StorefrontTheme {
  return typeof v === "string" && (THEME_KEYS as string[]).includes(v);
}

// Resolve a store row into the effective theme + merchant overrides applied.
export function resolveTheme(store: {
  storefrontTheme?: string | null;
  accentColor?: string | null;
  storefrontLayout?: "grid" | "menu" | "showcase" | null;
}) {
  const key: StorefrontTheme = isStorefrontTheme(store.storefrontTheme)
    ? store.storefrontTheme
    : "classic";
  const theme = THEMES[key];
  return {
    key,
    hero: theme.hero,
    // Merchant's explicit picks beat the theme defaults.
    accent: store.accentColor ?? theme.accent,
    layout: store.storefrontLayout ?? theme.layout,
  };
}
