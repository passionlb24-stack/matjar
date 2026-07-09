import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { getMyListings } from "@/lib/data/market";
import { Container } from "@/components/ui/container";
import { ProfileForm } from "@/components/profile-form";
import { AddressForm } from "@/components/address-form";
import { MyListingsManager } from "@/components/my-listings-manager";
import { PushOptIn } from "@/components/push-opt-in";

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

  const { data: address } = await supabase
    .from("addresses")
    .select("region, city, street, building, floor, details, phone")
    .eq("user_id", user.id)
    .maybeSingle();
  const addressInitial = {
    region: (address?.region as string | null) ?? "",
    city: (address?.city as string | null) ?? "",
    street: (address?.street as string | null) ?? "",
    building: (address?.building as string | null) ?? "",
    floor: (address?.floor as string | null) ?? "",
    details: (address?.details as string | null) ?? "",
    phone: (address?.phone as string | null) ?? "",
  };

  const myListings = await getMyListings(user.id, lang as Locale);

  return (
    <div className="py-10">
      <Container className="max-w-xl">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {dict.account.title}
        </h1>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary-soft p-4">
          <p className="text-sm font-semibold">{dict.push.prompt}</p>
          <PushOptIn dict={dict} />
        </div>

        <div className="mt-6">
          <ProfileForm dict={dict} initial={initial} />
        </div>
        <div className="mt-6">
          <AddressForm lang={lang} dict={dict} initial={addressInitial} />
        </div>

        <div className="mt-10 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-extrabold tracking-tight">
            {dict.market.myListings}
          </h2>
          <Link
            href={`/${lang}/market/new`}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" />
            {dict.market.publish}
          </Link>
        </div>
        <div className="mt-4">
          <MyListingsManager
            listings={myListings}
            lang={lang as Locale}
            dict={dict}
          />
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href={`/${lang}/orders`}
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
          >
            {dict.orders.title}
          </Link>
          <Link
            href={`/${lang}/bookings`}
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
          >
            {dict.booking.myBookings}
          </Link>
          <Link
            href={`/${lang}/favorites`}
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
          >
            {dict.favorites.title}
          </Link>
          <Link
            href={`/${lang}/following`}
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
          >
            {dict.following.title}
          </Link>
          <Link
            href={`/${lang}/wishlist`}
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
          >
            {dict.wishlist.title}
          </Link>
        </div>
      </Container>
    </div>
  );
}
