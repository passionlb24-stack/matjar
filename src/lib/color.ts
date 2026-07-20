// Derive the storefront's primary CSS-var overrides from a merchant's brand hex.
// globals.css maps --color-primary -> --primary (and hover/foreground/soft), so
// setting these four vars on a container restyles every bg-primary/text-primary
// beneath it. We compute a darker hover, a light soft tint, and a contrast-aware
// foreground so the brand color stays legible without the merchant tuning shades.

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function toHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b].map((n) => clampByte(n).toString(16).padStart(2, "0")).join("")
  );
}

// Linear blend of a channel toward a target (0..1).
function mix(c: number, target: number, t: number) {
  return c + (target - c) * t;
}

// Returns the CSS custom properties to spread onto a store container's `style`,
// or undefined when there's no (valid) accent — callers then fall back to the
// platform default. Typed loosely so it drops into React's style prop.
export function accentStyle(
  hex: string | null | undefined,
): Record<string, string> | undefined {
  if (!hex) return undefined;
  const rgb = parseHex(hex);
  if (!rgb) return undefined;
  const [r, g, b] = rgb;
  const hover = toHex(mix(r, 0, 0.16), mix(g, 0, 0.16), mix(b, 0, 0.16));
  const soft = toHex(mix(r, 255, 0.9), mix(g, 255, 0.9), mix(b, 255, 0.9));
  // sRGB relative luminance → dark ink on light accents, white on dark accents.
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const fg = lum > 0.62 ? "#0b1220" : "#ffffff";
  return {
    "--primary": toHex(r, g, b),
    "--primary-hover": hover,
    "--primary-foreground": fg,
    "--primary-soft": soft,
  };
}
