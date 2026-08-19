import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ===== matjar/no-raw-palette =====
//
// Tailwind's stock palette (bg-red-500, text-gray-400, border-slate-200 …) does
// not exist in this design system. Every colour on screen is supposed to come
// from a token in globals.css, because that is the only reason the dark theme
// works at all: the theme swaps token VALUES, and a class that names a fixed
// palette shade opts out of the swap and stays whatever it was in light mode.
//
// Written as an inline flat-config plugin rather than pulled from a package
// because this repo does not take new dependencies, and because a generic
// no-restricted-syntax regex could only ever say *don't*. The failure mode of a
// lint rule that says "don't do that" without saying what to do instead is that
// people reach for eslint-disable, so every message here names the specific
// token to use.
//
// Detection is textual, over string literals and template chunks, which is what
// Tailwind class names are. It therefore also fires inside strings that are not
// className props but end up in one (colour maps in src/lib/catalog.ts and
// src/lib/sectors.ts, for instance) — which is correct, those are the same bug.

const PALETTE = [
  "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
];

const UTILITY =
  "bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|shadow|divide|accent|caret|placeholder";

// Variants (hover:, dark:, sm:, group-hover:, rtl:) are just preceding text and
// are skipped over by the scan; \b at the front is what keeps `hover:bg-red-500`
// reported once rather than twice.
const RAW_PALETTE = new RegExp(
  `\\b(${UTILITY})-(${PALETTE.join("|")})-(50|\\d{3})\\b`,
  "g",
);

// What to say instead, keyed by colour family and then by the utility's role,
// so the message can name an actual token rather than gesturing at "a token".
const ADVICE = [
  {
    families: ["slate", "gray", "zinc", "neutral", "stone"],
    bg: "bg-surface (a card), bg-surface-muted (a subtle fill) or bg-background (the page)",
    text: "text-foreground (primary ink) or text-muted-foreground (secondary)",
    border: "border-border (a hairline), or border-border-strong for a form control's own boundary",
    other: "a surface/foreground token",
  },
  {
    families: ["red", "rose"],
    bg: "bg-danger-soft (a tinted pill behind dark text) or bg-danger-strong (a solid fill under white text)",
    text: "text-danger",
    border: "border-danger/30",
    other: "the --danger family",
  },
  {
    families: ["green", "emerald", "teal", "lime"],
    bg: 'bg-success-soft (tinted) or bg-success-strong (solid fill under white text) — and for a WhatsApp CTA, <Button variant="whatsapp"> or bg-whatsapp',
    text: "text-success",
    border: "border-success/30",
    other: "the --success family, or --whatsapp for a WhatsApp affordance",
  },
  {
    families: ["amber", "yellow", "orange"],
    bg: 'bg-warning-soft, or bg-accent-soft / <Badge variant="accent"> when it means "featured/Pro" rather than "needs attention"',
    text: "text-warning, or text-accent / text-accent-foreground for featured-Pro emphasis",
    border: "border-warning/30",
    other: "the --warning family, or --accent for featured/Pro emphasis",
  },
  {
    families: ["blue", "sky", "indigo", "cyan"],
    bg: "bg-info-soft, or bg-primary / bg-primary-soft when it is the brand blue rather than an informational state",
    text: "text-info, or text-primary for brand emphasis",
    border: "border-info/30, or border-primary/30",
    other: "the --info family, or --primary for the brand blue",
  },
  {
    families: ["violet", "purple", "fuchsia", "pink"],
    bg: "no token exists for this hue — add one to globals.css (:root AND both dark blocks) before using it, or pick the semantic family you actually mean",
    text: "no token exists for this hue — add one to globals.css (:root AND both dark blocks) before using it, or pick the semantic family you actually mean",
    border: "no token exists for this hue — add one to globals.css (:root AND both dark blocks) before using it, or pick the semantic family you actually mean",
    other: "no token exists for this hue — add one to globals.css (:root AND both dark blocks) before using it, or pick the semantic family you actually mean",
  },
];

function adviceFor(utility, family) {
  const group = ADVICE.find((g) => g.families.includes(family));
  if (!group) return "a semantic token from globals.css";
  if (["bg", "from", "to", "via"].includes(utility)) return group.bg;
  if (["text", "fill", "stroke", "placeholder", "caret"].includes(utility))
    return group.text;
  if (["border", "ring", "divide", "outline"].includes(utility))
    return group.border;
  return group.other;
}

const noRawPalette = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Ban Tailwind's stock palette classes; colours come from the design tokens in globals.css.",
    },
    schema: [],
    messages: {
      raw: "`{{ found }}` is a raw Tailwind palette colour. It will not follow the dark theme — the theme swaps token values, and this class names a fixed shade. Use {{ advice }}. If the colour genuinely must not change (a printed document, a third party's brand), add the file to PALETTE_ALLOWLIST in eslint.config.mjs with the reason.",
    },
  },
  create(context) {
    function scan(node, raw) {
      if (typeof raw !== "string" || raw.length === 0) return;
      RAW_PALETTE.lastIndex = 0;
      let m;
      while ((m = RAW_PALETTE.exec(raw)) !== null) {
        context.report({
          node,
          messageId: "raw",
          data: { found: m[0], advice: adviceFor(m[1], m[2]) },
        });
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === "string") scan(node, node.value);
      },
      TemplateElement(node) {
        scan(node, node.value.raw);
      },
    };
  },
};

const matjar = { rules: { "no-raw-palette": noRawPalette } };

// Files allowed to name palette colours, each for a stated reason. Keep the
// list short and keep the reasons here — an allow-list without reasons turns
// into a place to hide things.
const PALETTE_ALLOWLIST = [
  // A printed A4 invoice: ink on white paper, not a themed surface. Its colours
  // must NOT flip in the dark theme or the printout comes out inverted.
  "src/components/hub/invoice-generator.tsx",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees are full checkouts of this same repo living inside it, so
    // without this every file gets linted once per worktree. Left unignored it
    // had already tripled the warning count — 8 real ones became 24 identical
    // ones — which is how a genuine new warning stops being noticeable.
    ".claude/worktrees/**",
  ]),

  // The primitives are the one place a raw palette colour is unambiguously a
  // bug: every screen inherits their colours, so a fixed shade in here leaks
  // into hundreds of call sites and cannot be overridden from outside. Error,
  // and ui/ is clean as of this commit, so the gate holds at zero.
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    plugins: { matjar },
    rules: { "matjar/no-raw-palette": "error" },
  },

  // Everywhere else: warn. The remaining violations are a real backlog spread
  // over data files and the /hub marketing pages; turning them into errors today
  // would mean either one unreviewable colour-swap commit or a wall of
  // eslint-disable. A warning still surfaces in CI output and in the editor, and
  // it stops NEW ones from being written without anyone noticing.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**", ...PALETTE_ALLOWLIST],
    plugins: { matjar },
    rules: { "matjar/no-raw-palette": "warn" },
  },
]);

export default eslintConfig;
