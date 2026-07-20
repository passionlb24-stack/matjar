import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { PrintInvoiceButton } from "@/components/print-invoice-button";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function money(n: number) {
  return `$${Number(Number(n).toFixed(2)).toLocaleString("en-US")}`;
}

// Print-friendly order invoice for the merchant (print → Save as PDF).
export default async function OrderInvoicePage({
  params,
}: {
  params: Promise<{ lang: string; storeId: string; orderId: string }>;
}) {
  const { lang, storeId, orderId } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(storeId) || !UUID_RE.test(orderId))
    redirect(`/${lang}/merchant`);
  const dict = await getDictionary(lang);
  const t = dict.os.invoice;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data: canManage } = await supabase.rpc("can_manage_store", {
    p_store_id: storeId,
  });
  if (!canManage) redirect(`/${lang}/merchant`);

  const [{ data: store }, { data: orderData }] = await Promise.all([
    supabase
      .from("stores")
      .select("id, name, logo_url, phone, area")
      .eq("id", storeId)
      .maybeSingle(),
    supabase
      .from("orders")
      .select(
        "id, status, subtotal, discount, total, fulfillment, address, phone, customer_name, created_at, order_items(name, unit_price, quantity)",
      )
      .eq("id", orderId)
      .eq("store_id", storeId)
      .maybeSingle(),
  ]);
  if (!store || !orderData) redirect(`/${lang}/merchant/${storeId}/orders`);

  const s = store as unknown as {
    name: string;
    logo_url: string | null;
    phone: string | null;
    area: string | null;
  };
  const order = orderData as unknown as {
    id: string;
    status: string;
    subtotal: number;
    discount: number | null;
    total: number;
    fulfillment: string;
    address: string | null;
    phone: string | null;
    customer_name: string | null;
    created_at: string;
    order_items: { name: string; unit_price: number; quantity: number }[];
  };

  const fmtDate = new Date(order.created_at).toLocaleString(
    lang === "ar" ? "ar" : "en",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  return (
    <div className="py-8 print:py-0">
      <Container className="max-w-2xl">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <Link
            href={`/${lang}/merchant/${storeId}/orders`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            {dict.merchant.ordersTitle}
          </Link>
          <PrintInvoiceButton label={dict.orders.print} />
        </div>

        {/* The receipt itself — clean, black-on-white, PDF-ready. */}
        <div className="mt-4 rounded-2xl border border-border bg-surface p-6 print:mt-0 print:rounded-none print:border-0 print:p-0 sm:p-8">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-5">
            <div className="flex items-center gap-3">
              {s.logo_url && (
                <Image
                  src={s.logo_url}
                  alt=""
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-xl object-cover"
                />
              )}
              <div>
                <h1 className="text-xl font-extrabold">{s.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {[s.area, s.phone].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <div className="text-end">
              <p className="text-lg font-extrabold">{t.title}</p>
              <p className="text-sm text-muted-foreground" dir="ltr">
                #{order.id.slice(0, 8)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-b border-border py-4 text-sm">
            <div>
              <p className="font-bold">{t.customer}</p>
              <p className="text-muted-foreground">
                {order.customer_name ?? "—"}
              </p>
              {order.phone && (
                <p className="text-muted-foreground" dir="ltr">
                  {order.phone}
                </p>
              )}
              {order.address && (
                <p className="text-muted-foreground">{order.address}</p>
              )}
            </div>
            <div className="text-end">
              <p className="font-bold">{t.date}</p>
              <p className="text-muted-foreground">{fmtDate}</p>
              <p className="mt-1 text-muted-foreground">
                {order.fulfillment === "delivery"
                  ? dict.store.delivery
                  : dict.store.pickup}{" "}
                · {t.cod}
              </p>
            </div>
          </div>

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-start text-xs font-bold uppercase text-muted-foreground">
                <th className="pb-2 text-start">{t.item}</th>
                <th className="pb-2 text-center">{t.qty}</th>
                <th className="pb-2 text-end">{t.unitPrice}</th>
                <th className="pb-2 text-end">{t.lineTotal}</th>
              </tr>
            </thead>
            <tbody>
              {order.order_items.map((it, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="py-2.5 font-semibold">{it.name}</td>
                  <td className="py-2.5 text-center tabular-nums">
                    {it.quantity}
                  </td>
                  <td className="py-2.5 text-end tabular-nums">
                    {money(it.unit_price)}
                  </td>
                  <td className="py-2.5 text-end font-bold tabular-nums">
                    {money(it.unit_price * it.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ms-auto mt-4 max-w-56 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>{t.subtotal}</span>
              <span className="tabular-nums">{money(order.subtotal)}</span>
            </div>
            {Number(order.discount) > 0 && (
              <div className="flex justify-between text-danger">
                <span>{t.discount}</span>
                <span className="tabular-nums">
                  -{money(Number(order.discount))}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-extrabold">
              <span>{t.total}</span>
              <span className="tabular-nums">{money(order.total)}</span>
            </div>
          </div>

          <div className="mt-8 border-t border-border pt-4 text-center text-sm text-muted-foreground">
            <p className="font-semibold">{t.thanks}</p>
            <p className="mt-1 text-xs">{t.poweredBy}</p>
          </div>
        </div>
      </Container>
    </div>
  );
}
