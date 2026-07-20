import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
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
  } | null;
  is_read: boolean;
};

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

  const { data } = await supabase
    .from("notifications")
    .select("id, type, data, is_read")
    .eq("user_id", user.id)
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
          : n.type === "message"
          ? n.data?.conversation_id
            ? `/${lang}/messages/${n.data.conversation_id}`
            : `/${lang}/messages`
          : n.type === "order_new" || n.type === "booking_new"
            ? `/${lang}/merchant`
            : n.type === "order_status"
              ? `/${lang}/orders`
              : `/${lang}/bookings`;

  return (
    <div className="py-10">
      <Container className="max-w-3xl">
        <MarkNotificationsRead />
        <h1 className="text-3xl font-extrabold tracking-tight">
          {dict.notifications.title}
        </h1>

        {notifs.length ? (
          <div className="mt-8 space-y-2">
            {notifs.map((n) => (
              <Link
                key={n.id}
                href={linkFor(n)}
                className={`block rounded-2xl border p-4 transition-colors ${
                  n.is_read
                    ? "border-border bg-surface"
                    : "border-primary/30 bg-primary-soft"
                }`}
              >
                <p className="font-semibold">{titleFor(n)}</p>
                {n.type === "store_campaign" && n.data?.body?.trim() && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {n.data.body}
                  </p>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Bell className="h-7 w-7" />
            </span>
            <p className="mt-4 text-muted-foreground">
              {dict.notifications.empty}
            </p>
          </div>
        )}
      </Container>
    </div>
  );
}
