import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { getUsdLbpRate } from "@/lib/data/settings";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LogoutButton } from "@/components/logout-button";

// Shared chrome (header + footer) for all public marketing/browse pages.
export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    lbpRate,
  ] = await Promise.all([supabase.auth.getUser(), getUsdLbpRate()]);
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";

  let unread = 0;
  let dashboardHref: string | null = null;
  let suspended = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile as { role?: string } | null)?.role;
    suspended =
      (profile as { is_active?: boolean } | null)?.is_active === false;
    if (role === "super_admin") dashboardHref = `/${lang}/admin`;
    else if (role === "merchant") dashboardHref = `/${lang}/merchant`;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    unread = count ?? 0;
  }

  if (suspended) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-extrabold">{dict.admin.suspendedTitle}</h1>
        <p className="max-w-sm text-muted-foreground">
          {dict.admin.suspendedBody}
        </p>
        <LogoutButton label={dict.auth.logout} />
      </div>
    );
  }

  return (
    <>
      <SiteHeader
        lang={lang}
        dict={dict}
        user={user ? { name: displayName } : null}
        unread={unread}
        dashboardHref={dashboardHref}
        lbpRate={lbpRate}
      />
      <main className="flex-1">{children}</main>
      <SiteFooter lang={lang} dict={dict} />
    </>
  );
}
