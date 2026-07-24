import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AdminSection } from "@/lib/admin-sections";

// Per-section server guard for individual /admin/*/page.tsx routes.
// The admin layout already gates entry (super_admin OR ≥1 granted section),
// but each page must additionally verify the specific section so a sub-admin
// granted one section cannot open another /admin/* route by URL. Mirrors the
// access logic in admin/layout.tsx. RLS remains the real write enforcement;
// this is defense-in-depth on the page shell.
export async function requireAdminSection(
  section: AdminSection,
  lang: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, admin_permissions")
    .eq("id", user.id)
    .maybeSingle();

  const p = profile as
    | { role?: string; admin_permissions?: string[] | null }
    | null;
  const isSuper = p?.role === "super_admin";
  const perms = Array.isArray(p?.admin_permissions) ? p!.admin_permissions! : [];
  if (!isSuper && !perms.includes(section)) {
    redirect(`/${lang}`);
  }
}
