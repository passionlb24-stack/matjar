import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Crown, Check, Sparkles } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { RequestProButton } from "@/components/request-pro-button";
import { PRO_PRICE_MONTHLY, PRO_PRICE_YEARLY } from "@/lib/plan";

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
    .select("id, name, plan, owner_id, trial_ends_at")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);
  // Billing is owner-only (matches the registry's ownerOnly flag).
  if ((store as unknown as { owner_id: string }).owner_id !== user.id)
    redirect(`/${lang}/merchant/${storeId}`);
  // Read the RAW plan here (not the trial-collapsed effective plan): a store on
  // an active free trial is still on the free plan for billing, so we keep the
  // subscribe CTA visible and show a trial-countdown banner instead.
  const plan = (store as { plan: "free" | "pro" }).plan;
  const isPro = plan === "pro";
  const trialEndsAt =
    (store as { trial_ends_at: string | null }).trial_ends_at ?? null;
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null;
  const onTrial = !isPro && trialEnd != null && trialEnd > new Date();
  const trialDaysLeft = onTrial
    ? Math.max(
        1,
        Math.ceil((trialEnd!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      )
    : 0;

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
              <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success">
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

        {/* Active free trial: Pro features are unlocked but billing is still
            free — nudge the owner to subscribe before the trial ends. */}
        {onTrial && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm font-semibold text-primary">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              {t.trialBanner.replace("{days}", String(trialDaysLeft))}
            </span>
          </div>
        )}

        {/* Upgrade CTA for free stores (kept visible during the trial). */}
        {!isPro && (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-6">
            <h2 className="flex items-center gap-2 text-lg font-extrabold">
              <Crown className="h-5 w-5 text-amber-500" />
              {t.upgradeTitle}
            </h2>
            <p className="mt-2 text-sm text-amber-900/80">{t.upgradeBody}</p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-900">
                ${PRO_PRICE_MONTHLY}
              </span>
              <span className="text-sm font-semibold text-amber-900/70">
                {dict.pricing.perMonth}
              </span>
              <span className="text-sm font-bold text-amber-700">
                · ${PRO_PRICE_YEARLY}
                {dict.pricing.perYear}
              </span>
            </p>
            <ul className="mt-3 grid gap-1.5">
              {dict.os.pro.benefits.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2 text-sm font-medium text-amber-900"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  {b}
                </li>
              ))}
            </ul>
            <RequestProButton
              storeId={storeId}
              requestLabel={t.requestUpgrade}
              sentLabel={t.requestSent}
            />
            <p className="mt-2 text-xs text-amber-900/70">{t.requestNote}</p>
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
