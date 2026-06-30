import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OrderRow = {
  customer_id: string;
  customer_name: string | null;
  phone: string | null;
  total: number;
};

function formatPrice(price: number) {
  return price >= 1000
    ? `$${Number(price).toLocaleString("en-US")}`
    : `$${price}`;
}

export default async function StoreCustomersPage({
  params,
}: {
  params: Promise<{ lang: string; storeId: string }>;
}) {
  const { lang, storeId } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(storeId)) redirect(`/${lang}/merchant`);
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data: store } = await supabase
    .from("stores")
    .select("id, name")
    .eq("id", storeId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);

  const { data } = await supabase
    .from("orders")
    .select("customer_id, customer_name, phone, total")
    .eq("store_id", storeId);
  const orders = (data ?? []) as OrderRow[];

  const map = new Map<
    string,
    { name: string | null; phone: string | null; count: number; total: number }
  >();
  orders.forEach((o) => {
    const c = map.get(o.customer_id) ?? {
      name: null,
      phone: null,
      count: 0,
      total: 0,
    };
    c.count += 1;
    c.total += Number(o.total);
    if (!c.name && o.customer_name) c.name = o.customer_name;
    if (!c.phone && o.phone) c.phone = o.phone;
    map.set(o.customer_id, c);
  });
  const customers = [...map.values()].sort((a, b) => b.total - a.total);

  return (
    <div className="py-10">
      <Container className="max-w-3xl">
        <Link
          href={`/${lang}/merchant/${storeId}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {(store as { name: string }).name}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          {dict.merchant.customersTitle}
        </h1>

        {customers.length ? (
          <div className="mt-8 space-y-3">
            {customers.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5"
              >
                <div>
                  <p className="font-bold">{c.name ?? c.phone ?? "—"}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {c.phone ? `${c.phone} · ` : ""}
                    {c.count} {dict.merchant.ordersCount}
                  </p>
                </div>
                <span className="font-bold text-primary">
                  {formatPrice(c.total)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
            {dict.merchant.noCustomers}
          </div>
        )}
      </Container>
    </div>
  );
}
