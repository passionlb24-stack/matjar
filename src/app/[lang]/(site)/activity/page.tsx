import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { getCustomerActivity } from "@/lib/data/activity";
import { Container } from "@/components/ui/container";
import { ActivityList } from "@/components/activity-list";
import type { ActivityKind } from "@/lib/data/activity";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// طلباتي — the customer's own transactions, all four kinds, one screen.
//
// This is the route the new bottom tab points at. Before it existed the answer
// to "where is my thing?" was five different URLs, none of them reachable
// without going through Account first.
export default async function ActivityPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login?next=/${lang}/activity`);

  const dict = await getDictionary(lang);
  const items = await getCustomerActivity(lang);
  const t = dict.activity as unknown as Record<string, string>;

  // Each domain's own wording, passed through untouched.
  const statusLabels: Record<ActivityKind, Record<string, string>> = {
    order: dict.orders.status as unknown as Record<string, string>,
    booking: dict.booking.status as unknown as Record<string, string>,
    craft: dict.crafts.reqStatuses as unknown as Record<string, string>,
    lead: {},
  };

  return (
    <div className="py-6 sm:py-10">
      <Container className="max-w-2xl">
        <h1 className="text-h1">{t.title}</h1>
        <p className="mt-1 text-caption">{t.subtitle}</p>

        <ActivityList
          items={items}
          lang={lang}
          labels={{ ...t, emptyHref: `/${lang}/explore` }}
          statusLabels={statusLabels}
        />
      </Container>
    </div>
  );
}
