// Canonical list of admin sections a sub-admin can be granted, in display order.
// Keys match both the admin nav item keys and the `admin_can(section)` DB check
// (migration 0149) — one source of truth shared by the nav and the roles editor.
// 'overview' is intentionally excluded: it's the dashboard shortcut surface,
// always visible to any platform admin.
export const ADMIN_SECTIONS = [
  "stores",
  "orders",
  "market",
  "delivery",
  "jobs",
  "freelance",
  "wholesale",
  "leaders",
  "academy",
  "reviews",
  "verifications",
  "messages",
  "questions",
  "subscriptions",
  "reports",
  "growth",
  "deals",
  "users",
  "types",
  "pages",
  "audit",
  "settings",
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

// "all" = super admin (everything); otherwise the explicit list of granted keys.
export type AdminAccess = "all" | string[];

export function canAccess(access: AdminAccess, section: string): boolean {
  return access === "all" || access.includes(section);
}
