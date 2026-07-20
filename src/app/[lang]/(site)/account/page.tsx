import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Plus,
  Package,
  CalendarCheck,
  Heart,
  Bookmark,
  MessageCircle,
  Briefcase,
  Sparkles,
  Boxes,
  CircleUser,
} from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { getMyListings } from "@/lib/data/market";
import { SITE_URL } from "@/lib/site";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { ProfileForm } from "@/components/profile-form";
import { LoyaltyPanel } from "@/components/loyalty-panel";
import { AddressManager, type AddressRow } from "@/components/address-manager";
import { MyListingsManager } from "@/components/my-listings-manager";
import { PushOptIn } from "@/components/push-opt-in";
import {
  SavedSearchesManager,
  type SavedSearchRow,
} from "@/components/saved-searches-manager";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  const initial = {
    full_name:
      (profile?.full_name as string | null) ??
      (user.user_metadata?.full_name as string | undefined) ??
      "",
    phone: (profile?.phone as string | null) ?? "",
  };

  const { data: addressRows } = await supabase
    .from("addresses")
    .select("id, label, region, city, street, building, floor, details, phone, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  // Loyalty + referral.
  const [{ data: referralCode }, { data: pointsBalance }, refsRes, historyRes] =
    await Promise.all([
      supabase.rpc("get_my_referral_code"),
      supabase.rpc("loyalty_balance", { p_user: user.id }),
      supabase.from("referrals").select("status").eq("referrer_id", user.id),
      supabase
        .from("loyalty_ledger")
        .select("delta, reason, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
  const referralCount = ((refsRes.data ?? []) as { status: string }[]).filter(
    (r) => r.status === "rewarded",
  ).length;

  const myListings = await getMyListings(user.id, lang as Locale);

  const { data: savedSearches } = await supabase
    .from("saved_searches")
    .select("id, q, category, region, city")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="py-10">
      <Container className="max-w-xl">
        <PageHeader title={dict.account.title} icon={CircleUser} />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary-soft p-4">
          <p className="text-sm font-semibold">{dict.push.prompt}</p>
          <PushOptIn dict={dict} />
        </div>

        <div className="mt-6">
          <LoyaltyPanel
            lang={lang as Locale}
            dict={dict}
            balance={(pointsBalance as number | null) ?? 0}
            code={(referralCode as string | null) ?? ""}
            referralCount={referralCount}
            history={(historyRes.data ?? []) as {
              delta: number;
              reason: string;
              created_at: string;
            }[]}
            siteUrl={SITE_URL}
          />
        </div>
        <div className="mt-6">
          <ProfileForm dict={dict} initial={initial} />
        </div>
        <div className="mt-6">
          <AddressManager
            lang={lang as Locale}
            dict={dict}
            rows={(addressRows ?? []) as AddressRow[]}
          />
        </div>

        <div className="mt-10 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-extrabold tracking-tight">
            {dict.market.myListings}
          </h2>
          <ButtonLink
            href={`/${lang}/market/new`}
            className="shrink-0"
            leftIcon={<Plus className="h-4 w-4" />}
          >
            {dict.market.publish}
          </ButtonLink>
        </div>
        <div className="mt-4">
          <MyListingsManager
            listings={myListings}
            lang={lang as Locale}
            dict={dict}
          />
        </div>

        <SavedSearchesManager
          rows={(savedSearches ?? []) as SavedSearchRow[]}
          lang={lang as Locale}
          dict={dict}
        />

        {[
          {
            title: dict.account.groupOrders,
            items: [
              { href: `/${lang}/orders`, label: dict.orders.title, Icon: Package },
              { href: `/${lang}/bookings`, label: dict.booking.myBookings, Icon: CalendarCheck },
            ],
          },
          {
            title: dict.account.groupSaved,
            items: [
              { href: `/${lang}/favorites`, label: dict.favorites.title, Icon: Heart },
              { href: `/${lang}/wishlist`, label: dict.wishlist.title, Icon: Bookmark },
              { href: `/${lang}/messages`, label: dict.messages.title, Icon: MessageCircle },
            ],
          },
          {
            title: dict.account.groupSelling,
            items: [
              { href: `/${lang}/jobs/mine`, label: dict.jobs.myPostings, Icon: Briefcase },
              { href: `/${lang}/freelance/mine`, label: dict.freelance.myGigs, Icon: Sparkles },
              { href: `/${lang}/wholesale/mine`, label: dict.wholesale.myListings, Icon: Boxes },
            ],
          },
        ].map((group) => (
          <div key={group.title} className="mt-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {group.items.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </Container>
    </div>
  );
}
