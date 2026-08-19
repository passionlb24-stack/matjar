import { dictSlice } from "@/lib/dict-slice";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { getUsdLbpRate } from "@/lib/data/settings";
import { getNavSections } from "@/lib/data/section-supply";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BottomNav } from "@/components/bottom-nav";
import {
  getCustomerActivity,
  countNeedingCustomer,
} from "@/lib/data/activity";
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
  // Which verticals are worth linking to at all (MP-026). Same cached, public,
  // cross-request read as the exchange rate beside it — the header, the phone
  // menu and the footer all ask the same question and must not answer it
  // differently on one page.
  const [
    {
      data: { user },
    },
    lbpRate,
    sections,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getUsdLbpRate(),
    getNavSections(),
  ]);
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";

  // Badge on the طلباتي tab: only what the customer must act on. Computed
  // here because the tab bar lives in this layout and every page renders it.
  let activityCount = 0;
  let unread = 0;
  let unreadMessages = 0;
  let dashboardHref: string | null = null;
  let suspended = false;
  if (user) {
    activityCount = countNeedingCustomer(await getCustomerActivity(lang));
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
    const [{ count }, { data: msgCount }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
        .neq("type", "message"),
      supabase.rpc("unread_conversation_count"),
    ]);
    unread = count ?? 0;
    unreadMessages = (msgCount as number | null) ?? 0;
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
      {/* First focusable element on every route: lets a keyboard user jump the
          whole header instead of tabbing it on all 137 pages (WCAG 2.4.1).
          Hidden until focused; positioned with logical `start-*` so it appears
          on the correct side in RTL and LTR alike. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[200] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-primary-foreground focus:shadow-lg"
      >
        {dict.common.skipToContent}
      </a>
      <SiteHeader
        lang={lang}
        dict={dict}
        user={user ? { name: displayName } : null}
        userId={user?.id ?? null}
        unread={unread}
        unreadMessages={unreadMessages}
        dashboardHref={dashboardHref}
        lbpRate={lbpRate}
        sections={sections}
      />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter lang={lang} dict={dict} sections={sections} />
      {/* Spacer so page content can scroll clear of the fixed mobile tab bar. */}
      <div
        aria-hidden
        className="h-[calc(var(--m-tabbar-h)+env(safe-area-inset-bottom))] lg:hidden"
      />
      <BottomNav
        lang={lang}
        dict={dictSlice(dict, ["tabbar"])}
        signedIn={!!user}
        activityCount={activityCount}
      />
    </>
  );
}
