import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Check, MapPin, Phone, StickyNote, Store as StoreIcon } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { formatUsd } from "@/lib/currency";
import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { OrderCancelButton } from "@/components/order-cancel-button";
import { ReorderButton } from "@/components/reorder-button";
import { PrintInvoiceButton } from "@/components/print-invoice-button";
import { ReviewForm } from "@/components/review-form";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Happy-path progression; cancelled/rejected are shown as a banner instead.
const FLOW = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
] as const;

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(id)) notFound();
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data } = await supabase
    .from("orders")
    .select(
      "id, status, subtotal, discount, total, fulfillment, address, phone, customer_note, created_at, customer_id, store_id, stores(name), order_items(name, unit_price, quantity, product_id)",
    )
    .eq("id", id)
    .maybeSingle();

  const order = data as unknown as {
    id: string;
    status: string;
    subtotal: number;
    discount: number | null;
    total: number;
    fulfillment: string;
    address: string | null;
    phone: string | null;
    customer_note: string | null;
    created_at: string;
    customer_id: string;
    store_id: string;
    stores: { name: string } | null;
    order_items: {
      name: string;
      unit_price: number;
      quantity: number;
      product_id: string | null;
    }[];
  } | null;

  // Only the owner may view their order detail.
  if (!order || order.customer_id !== user.id) notFound();

  // Nudge a review once the order is completed and not yet reviewed.
  let showReviewPrompt = false;
  if (order.status === "completed") {
    const { data: existing } = await supabase
      .from("reviews")
      .select("id")
      .eq("store_id", order.store_id)
      .eq("customer_id", user.id)
      .maybeSingle();
    showReviewPrompt = !existing;
  }
  const customerName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    "";

  const t = dict.orders;
  const cancelled = order.status === "cancelled" || order.status === "rejected";
  const currentIdx = FLOW.indexOf(order.status as (typeof FLOW)[number]);
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "ar" ? "ar" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="py-10">
      <Container className="max-w-2xl">
        <Breadcrumbs
          items={[
            { label: t.title, href: `/${lang}/orders` },
            { label: `#${order.id.slice(0, 8)}` },
          ]}
        />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {t.order} #{order.id.slice(0, 8)}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <StoreIcon className="h-4 w-4" />
              {order.stores?.name ?? "—"} · {t.placedOn} {fmtDate(order.created_at)}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 print:hidden">
            {order.status === "pending" && (
              <OrderCancelButton id={order.id} kind="order" dict={dict} />
            )}
            <ReorderButton
              storeId={order.store_id}
              items={order.order_items}
              lang={lang}
              dict={dict}
            />
            <PrintInvoiceButton label={t.print} />
          </div>
        </div>

        {/* Status */}
        {cancelled ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/60 p-4 text-center font-bold text-red-700">
            {t.status[order.status as "cancelled" | "rejected"]}
          </div>
        ) : (
          <ol className="mt-6 space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-xs">
            {FLOW.map((s, i) => {
              const done = i <= currentIdx;
              return (
                <li key={s} className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                      done
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span
                    className={`text-sm ${done ? "font-bold" : "text-muted-foreground"}`}
                  >
                    {t.status[s]}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {/* Review prompt (completed + not yet reviewed) */}
        {showReviewPrompt && order.stores && (
          <div className="mt-6 rounded-2xl border border-primary/30 bg-primary-soft/40 p-5 print:hidden">
            <p className="mb-3 font-bold">
              {dict.reviews.ratePrompt.replace("{store}", order.stores.name)}
            </p>
            <ReviewForm
              storeId={order.store_id}
              dict={dict}
              customerName={customerName}
            />
          </div>
        )}

        {/* Items */}
        <Card className="mt-6 p-5">
          <h2 className="mb-3 font-bold">{t.items}</h2>
          <div className="space-y-2">
            {order.order_items.map((it, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span>
                  {it.name}{" "}
                  <span className="text-muted-foreground">×{it.quantity}</span>
                </span>
                <span className="font-semibold">
                  {formatUsd(it.unit_price * it.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>{t.subtotal}</span>
              <span>{formatUsd(order.subtotal)}</span>
            </div>
            {order.discount ? (
              <div className="flex justify-between text-emerald-700">
                <span>{t.discount}</span>
                <span>-{formatUsd(order.discount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-base font-extrabold">
              <span>{t.total}</span>
              <span className="text-primary">{formatUsd(order.total)}</span>
            </div>
          </div>
        </Card>

        {/* Fulfillment */}
        <Card className="mt-6 space-y-2 p-5 text-sm">
          {order.address && (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {order.address}
            </p>
          )}
          {order.phone && (
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-primary" />
              {order.phone}
            </p>
          )}
          {order.customer_note && (
            <p className="flex items-start gap-2">
              <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {order.customer_note}
            </p>
          )}
        </Card>

        <Link
          href={`/${lang}/orders`}
          className="mt-6 inline-block text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground print:hidden"
        >
          ← {t.backToOrders}
        </Link>
      </Container>
    </div>
  );
}
