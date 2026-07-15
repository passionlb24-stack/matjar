import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Crown, Check } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatPrice(price: number) {
  return price >= 1000 ? `$${Number(price).toLocaleString("en-US")}` : `$${price}`;
}

export default async function StoreSubscriptionPage({
  params,
}: {
  params: Promise<{ lang: string; storeId: string }>;
}) {
  const { lang, storeId } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(storeId)) redirect(`/${lang}/merchant`);
  const dict = await getDictionary(lang);
  const t = dict.merchant.subscription;

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
    .select("id, name, plan, owner_id")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);
  // Billing is owner-only (matches the registry's ownerOnly flag).
  if ((store as unknown as { owner_id: string }).owner_id !== user.id)
    redirect(`/${lang}/merchant/${storeId}`);
  const plan = (store as { plan: "free" | "pro" }).plan;
  const isPro = plan === "pro";

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("expires_at")
    .eq("store_id", storeId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const expiresAt = (sub as { expires_at: string | null } | null)?.expires_at ?? null;

  const { data: paymentsData } = await supabase
    .from("payments")
    .select("id, amount, period, paid_at")
    .eq("store_id", storeId)
    .order("paid_at", { ascending: false });
  const payments = (paymentsData ?? []) as {
    id: string;
    amount: number;
    period: "monthly" | "yearly";
    paid_at: string;
  }[];

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "ar" ? "ar" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="py-10">
      <Container className="max-w-2xl">
        <Link
          href={`/${lang}/merchant/${storeId}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {(store as { name: string }).name}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{t.title}</h1>

        {/* Current plan */}
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-muted-foreground">{t.currentPlan}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-2xl font-extrabold">
              {isPro && <Crown className="h-6 w-6 text-amber-500" />}
              {isPro ? t.pro : t.free}
            </span>
            {isPro && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                {t.active}
              </span>
            )}
          </div>
          {isPro && expiresAt && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t.expiresOn}: <span className="font-semibold text-foreground">{fmtDate(expiresAt)}</span>
            </p>
          )}
          {isPro && (
            <p className="mt-3 font-semibold text-primary">{t.proActive}</p>
          )}
        </div>

        {/* Upgrade CTA for free stores */}
        {!isPro && (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-6">
            <h2 className="flex items-center gap-2 text-lg font-extrabold">
              <Crown className="h-5 w-5 text-amber-500" />
              {t.upgradeTitle}
            </h2>
            <p className="mt-2 text-sm text-amber-900/80">{t.upgradeBody}</p>
            <Link
              href={`/${lang}/pricing`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-600"
            >
              <Check className="h-4 w-4" />
              {t.viewPlans}
            </Link>
          </div>
        )}

        {/* Payment history */}
        <h2 className="mb-3 mt-8 text-lg font-bold">{t.paymentsTitle}</h2>
        {payments.length ? (
          <div className="space-y-2">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm"
              >
                <span className="font-semibold">{fmtDate(p.paid_at)}</span>
                <span className="text-muted-foreground">
                  {p.period === "yearly" ? t.yearly : t.monthly}
                </span>
                <span className="font-bold text-primary">
                  {formatPrice(p.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
            {t.noPayments}
          </div>
        )}
      </Container>
    </div>
  );
}
