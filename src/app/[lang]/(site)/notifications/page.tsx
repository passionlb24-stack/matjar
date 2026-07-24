import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { EmptyState } from "@/components/ui/empty-state";
import { MarkNotificationsRead } from "@/components/mark-notifications-read";

type Notif = {
  id: string;
  type: string;
  data: {
    store_id?: string;
    store_name?: string;
    product_id?: string;
    product_name?: string;
    old_price?: number | string;
    new_price?: number | string;
    listing_id?: string;
    conversation_id?: string;
    title?: string;
    body?: string;
    url?: string;
    name?: string;
    phone?: string;
    leader_id?: string;
  } | null;
  is_read: boolean;
  created_at: string;
};

// Relative time ("5 minutes ago" / "منذ ٥ دقائق"). Timezone-independent since
// it's a delta, so it's always correct regardless of server/client TZ.
function timeAgo(iso: string, lang: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang === "ar" ? "ar" : "en", {
    numeric: "auto",
  });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diff) >= secs) return rtf.format(-Math.round(diff / secs), unit);
  }
  return rtf.format(-diff, "second");
}

export default async function NotificationsPage({
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

  // Exclude `message` notifications: chat has its own inbox + unread badge, so
  // surfacing message events in the bell double-counts them ("notifications
  // showing up on my messages").
  const { data } = await supabase
    .from("notifications")
    .select("id, type, data, is_read, created_at")
    .eq("user_id", user.id)
    .neq("type", "message")
    .order("created_at", { ascending: false })
    .limit(50);
  const notifs = (data ?? []) as Notif[];

  const titleFor = (n: Notif) => {
    const t = n.type;
    if (t === "store_product") {
      const store = n.data?.store_name;
      return store
        ? dict.notifications.storeProductNamed.replace("{store}", store)
        : dict.notifications.storeProduct;
    }
    if (t === "price_drop") {
      return dict.notifications.priceDrop
        .replace("{product}", n.data?.product_name ?? "")
        .replace("{price}", String(n.data?.new_price ?? ""));
    }
    if (t === "pro_request") {
      return dict.notifications.proRequest.replace(
        "{store}",
        n.data?.store_name ?? "",
      );
    }
    // Merchant marketing campaign: the merchant authored the title/body; fall
    // back to a generic label when no title was given.
    if (t === "store_campaign") {
      return n.data?.title?.trim() || dict.notifications.storeCampaign;
    }
    if (t === "booking_placed") return dict.notifications.bookingPlaced;
    if (t === "order_placed") return dict.notifications.orderPlaced;
    if (t === "booking_status_merchant")
      return dict.notifications.bookingStatusMerchant;
    if (t === "order_status_merchant")
      return dict.notifications.orderStatusMerchant;
    return t === "order_new"
      ? dict.notifications.orderNew
      : t === "order_status"
        ? dict.notifications.orderStatus
        : t === "booking_new"
          ? dict.notifications.bookingNew
          : t === "booking_status"
            ? dict.notifications.bookingStatus
            : t === "listing_approved"
                ? dict.notifications.listingApproved
                : t === "listing_rejected"
                  ? dict.notifications.listingRejected
                  : t === "listing_match"
                    ? dict.notifications.listingMatch
                    : t === "message"
                      ? dict.notifications.message
                      : t === "store_new"
                        ? dict.notifications.storeNew
                        : t === "pro_request"
                          ? `${dict.notifications.proRequest}${n.data?.store_name ? " · " + n.data.store_name : ""}`
                          : t === "leader_submission"
                            ? `${dict.notifications.leaderSubmission}${n.data?.name ? " · " + n.data.name : ""}`
                            : t;
  };

  // Campaigns carry an explicit destination in data.url (the store, an offer,
  // etc.); fall back to the store page.
  const linkFor = (n: Notif): string =>
    n.type === "store_campaign"
      ? n.data?.url?.trim() ||
        (n.data?.store_id
          ? `/${lang}/store/${n.data.store_id}`
          : `/${lang}/notifications`)
      : (n.type === "listing_approved" ||
      n.type === "listing_rejected" ||
      n.type === "listing_match") &&
    n.data?.listing_id
      ? n.type === "listing_rejected"
        ? `/${lang}/account`
        : `/${lang}/market/${n.data.listing_id}`
      : n.type === "price_drop" && n.data?.product_id
        ? `/${lang}/product/${n.data.product_id}`
        : n.type === "store_product" && n.data?.store_id
        ? `/${lang}/store/${n.data.store_id}`
        : n.type === "store_new" || n.type === "pro_request"
          ? `/${lang}/admin/stores`
          : n.type === "leader_submission"
          ? `/${lang}/admin/leaders`
          : n.type === "message"
          ? n.data?.conversation_id
            ? `/${lang}/messages/${n.data.conversation_id}`
            : `/${lang}/messages`
          : n.type === "order_new" ||
              n.type === "booking_new" ||
              n.type === "order_status_merchant" ||
              n.type === "booking_status_merchant"
            ? `/${lang}/merchant`
            : n.type === "order_status" || n.type === "order_placed"
              ? `/${lang}/orders`
              : n.type === "booking_status" || n.type === "booking_placed"
                ? `/${lang}/bookings`
                : `/${lang}`;

  return (
    <div className="pb-16">
      <MarkNotificationsRead />
      <PageHero title={dict.notifications.title} icon={Bell} />
      <Container className="max-w-3xl py-8">
        {notifs.length ? (
          <div className="space-y-2">
            {notifs.map((n) => (
              <Link
                key={n.id}
                href={linkFor(n)}
                className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
                  n.is_read
                    ? "border-border bg-surface hover:border-primary/40"
                    : "border-primary/30 bg-primary-soft"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    n.is_read
                      ? "bg-surface-muted text-muted-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  <Bell className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{titleFor(n)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {timeAgo(n.created_at, lang)}
                  </p>
                  {n.type === "store_campaign" && n.data?.body?.trim() && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {n.data.body}
                    </p>
                  )}
                  {n.type === "pro_request" && n.data?.phone && (
                    <p className="mt-1 text-sm font-semibold text-primary" dir="ltr">
                      {dict.notifications.phoneLabel}: {n.data.phone}
                    </p>
                  )}
                </div>
                {!n.is_read && (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon={Bell} title={dict.notifications.empty} />
        )}
      </Container>
    </div>
  );
}
