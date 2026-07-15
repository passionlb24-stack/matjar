import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { ExpenseManager, type Expense } from "@/components/expense-manager";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEAD = new Set(["cancelled", "rejected"]);

function money(n: number) {
  return n >= 1000 ? `$${Number(n).toLocaleString("en-US")}` : `$${n}`;
}

export default async function AccountingPage({
  params,
}: {
  params: Promise<{ lang: string; storeId: string }>;
}) {
  const { lang, storeId } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(storeId)) redirect(`/${lang}/merchant`);
  const dict = await getDictionary(lang);
  const t = dict.merchant.accounting;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);
  const { data: canManage } = await supabase.rpc("can_manage_store", {
    p_store_id: storeId,
  });
  if (!canManage) redirect(`/${lang}/merchant`);
  const { data: store } = await supabase
    .from("stores")
    .select("id, name, owner_id")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);

  // Money data: staff need the orders permission.
  const isOwner =
    (store as unknown as { owner_id: string }).owner_id === user.id;
  if (!isOwner) {
    const { data: staffRow } = await supabase
      .from("store_staff")
      .select("permissions")
      .eq("store_id", storeId)
      .eq("user_id", user.id)
      .maybeSingle();
    const perms =
      (staffRow?.permissions as Record<string, boolean> | null) ?? {};
    if (!(perms.orders ?? false)) redirect(`/${lang}/merchant/${storeId}`);
  }

  const [
    { data: ordersData },
    { data: expData },
    { data: posData },
    { data: supTxData },
  ] = await Promise.all([
    supabase.from("orders").select("total, status").eq("store_id", storeId),
    supabase
      .from("store_expenses")
      .select("id, label, amount, category, spent_on")
      .eq("store_id", storeId)
      .order("spent_on", { ascending: false }),
    supabase.from("pos_sales").select("total").eq("store_id", storeId),
    supabase
      .from("supplier_transactions")
      .select("kind, amount")
      .eq("store_id", storeId),
  ]);

  const orders = (ordersData ?? []) as { total: number; status: string }[];
  const expenses = (expData ?? []) as Expense[];

  const onlineRevenue = orders
    .filter((o) => !DEAD.has(o.status))
    .reduce((s, o) => s + Number(o.total), 0);
  const posRevenue = ((posData ?? []) as { total: number }[]).reduce(
    (s, r) => s + Number(r.total),
    0,
  );
  const revenue = onlineRevenue + posRevenue;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const profit = revenue - totalExpenses;
  // What the store still owes suppliers (purchases − payments).
  const supplierDues = (
    (supTxData ?? []) as { kind: string; amount: number }[]
  ).reduce(
    (s, x) => s + (x.kind === "purchase" ? Number(x.amount) : -Number(x.amount)),
    0,
  );

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
        <h1 className="mt-3 flex items-center gap-2 text-3xl font-extrabold tracking-tight">
          <Wallet className="h-7 w-7 text-primary" />
          {t.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              {t.revenue}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-700">
              {money(revenue)}
            </p>
            {posRevenue > 0 && (
              <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                {dict.os.finance.online} {money(onlineRevenue)} ·{" "}
                {dict.os.finance.pos} {money(posRevenue)}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <TrendingDown className="h-4 w-4 text-red-600" />
              {t.expenses}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-red-600">
              {money(totalExpenses)}
            </p>
          </div>
          <div
            className={`rounded-2xl p-4 ${profit >= 0 ? "bg-primary text-primary-foreground" : "bg-red-600 text-white"}`}
          >
            <p className="text-xs font-medium opacity-80">{t.profit}</p>
            <p className="mt-1 text-2xl font-extrabold">{money(profit)}</p>
          </div>
        </div>

        {supplierDues > 0 && (
          <Link
            href={`/${lang}/merchant/${storeId}/suppliers`}
            className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 transition-colors hover:border-amber-400"
          >
            <span className="text-sm font-bold text-amber-800">
              {dict.os.finance.supplierDues}
            </span>
            <span className="text-lg font-extrabold tabular-nums text-amber-800">
              {money(supplierDues)}
            </span>
          </Link>
        )}

        <div className="mt-6">
          <ExpenseManager storeId={storeId} dict={dict} expenses={expenses} />
        </div>
      </Container>
    </div>
  );
}
