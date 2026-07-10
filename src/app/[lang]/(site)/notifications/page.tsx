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
  data: { store_id?: string; listing_id?: string } | null;
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

  const titleFor = (t: string) =>
    t === "order_new"
      ? dict.notifications.orderNew
      : t === "order_status"
        ? dict.notifications.orderStatus
        : t === "booking_new"
          ? dict.notifications.bookingNew
          : t === "booking_status"
            ? dict.notifications.bookingStatus
            : t === "store_product"
              ? dict.notifications.storeProduct
              : t === "listing_approved"
                ? dict.notifications.listingApproved
                : t === "listing_rejected"
                  ? dict.notifications.listingRejected
                  : t === "listing_match"
                    ? dict.notifications.listingMatch
                    : t;

  const linkFor = (n: Notif) =>
    (n.type === "listing_approved" ||
      n.type === "listing_rejected" ||
      n.type === "listing_match") &&
    n.data?.listing_id
      ? n.type === "listing_rejected"
        ? `/${lang}/account`
        : `/${lang}/market/${n.data.listing_id}`
      : n.type === "store_product" && n.data?.store_id
        ? `/${lang}/store/${n.data.store_id}`
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
                <p className="font-semibold">{titleFor(n.type)}</p>
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
