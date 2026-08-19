// Deterministic initials avatar for Business Leaders. The dataset ships with no
// official photos (every row is image_status = 'placeholder'), so instead of a
// generic silhouette we render the person's initials in a tint picked
// deterministically from their name — same name always gets the same tint.

// One slot of the shared categorical ramp per avatar (globals.css --tint-1 … 7).
// This replaced ten hand-picked gradients that carried WHITE initials: white on
// `from-amber-500` measures 2.15:1 and on `from-lime-500` 1.75:1, so the initials
// — the only content in the element — were unreadable at most hashes, and being
// raw palette shades they stayed exactly as illegible in the dark theme. The
// ramp's fill/ink pair clears 4.55:1 in both themes, so the initials read
// whichever slot a name lands on. Ten slots became seven; the hash still gives
// the same name the same tint, which is all it ever promised.
const TINTS = [
  "bg-tint-1-soft text-tint-1",
  "bg-tint-2-soft text-tint-2",
  "bg-tint-3-soft text-tint-3",
  "bg-tint-4-soft text-tint-4",
  "bg-tint-5-soft text-tint-5",
  "bg-tint-6-soft text-tint-6",
  "bg-tint-7-soft text-tint-7",
];

const SIZES = {
  sm: "h-12 w-12 text-sm",
  md: "h-16 w-16 text-lg",
  lg: "h-20 w-20 text-2xl",
  xl: "h-28 w-28 text-3xl",
} as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "؟";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "");
}

function hashHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h % TINTS.length;
}

export function InitialsAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const tint = TINTS[hashHue(name)];
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-extrabold ${tint} ${SIZES[size]} ${className ?? ""}`}
    >
      {getInitials(name)}
    </span>
  );
}
