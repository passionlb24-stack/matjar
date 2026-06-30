import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";

  let unread = 0;
  let dashboardHref: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile as { role?: string } | null)?.role;
    if (role === "super_admin") dashboardHref = `/${lang}/admin`;
    else if (role === "merchant") dashboardHref = `/${lang}/merchant`;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    unread = count ?? 0;
  }

  return (
    <>
      <SiteHeader
        lang={lang}
        dict={dict}
        user={user ? { name: displayName } : null}
        unread={unread}
        dashboardHref={dashboardHref}
      />
      <main className="flex-1">{children}</main>
      <SiteFooter lang={lang} dict={dict} />
    </>
  );
}
