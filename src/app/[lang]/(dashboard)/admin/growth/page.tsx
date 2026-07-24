import { notFound } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { requireAdminSection } from "@/lib/admin-guard";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Coupon = {
  id: string;
  code: string | null;
  type: string | null;
  value: number | null;
  used_count: number | null;
  is_active: boolean | null;
  expires_at: string | null;
  stores: { name: string } | null;
};

type Campaign = {
  id: string;
  title: string | null;
  audience: string | null;
  sent_count: number | null;
  created_at: string;
  stores: { name: string } | null;
};

type Automation = {
  id: string;
  name: string | null;
  trigger: string | null;
  enabled: boolean | null;
  stores: { name: string } | null;
};

type LoyaltyRow = { delta: number | null; user_id: string | null };
type ReferralRow = { status: string | null };

function num(n: number) {
  return n.toLocaleString("en-US");
}

function couponValue(c: Coupon) {
  if (c.value == null) return "—";
  if (c.type === "amount") return `$${c.value}`;
  if (c.type === "percent") return `${c.value}%`;
  return `${c.value} ${c.type ?? ""}`.trim();
}

export default async function AdminGrowthPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireAdminSection("growth", lang);
  const dict = await getDictionary(lang);
  const t = dict.admin.growth;

  const supabase = await createClient();
  const [
    couponsRes,
    campaignsRes,
    automationsRes,
    automationRunsRes,
    loyaltyRes,
    referralsRes,
  ] = await Promise.all([
    supabase
      .from("coupons")
      .select(
        "id, code, type, value, used_count, is_active, expires_at, stores(name)",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("store_campaigns")
      .select("id, title, audience, sent_count, created_at, stores(name)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("automations")
      .select("id, name, trigger, enabled, stores(name)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("automation_runs").select("id", { count: "exact", head: true }),
    supabase.from("loyalty_ledger").select("delta, user_id").limit(5000),
    supabase.from("referrals").select("status").limit(5000),
  ]);

  const coupons = (couponsRes.data ?? []) as unknown as Coupon[];
  const campaigns = (campaignsRes.data ?? []) as unknown as Campaign[];
  const automations = (automationsRes.data ?? []) as unknown as Automation[];
  const runsCount = automationRunsRes.count ?? 0;
  const loyalty = (loyaltyRes.data ?? []) as unknown as LoyaltyRow[];
  const referrals = (referralsRes.data ?? []) as unknown as ReferralRow[];

  // Coupon KPIs
  const couponsTotal = coupons.length;
  const couponsActive = coupons.filter((c) => c.is_active).length;
  const couponsUsed = coupons.reduce((s, c) => s + (c.used_count ?? 0), 0);

  // Campaign KPIs
  const campaignsTotal = campaigns.length;
  const campaignsSent = campaigns.reduce((s, c) => s + (c.sent_count ?? 0), 0);

  // Automation KPIs
  const automationsTotal = automations.length;
  const automationsEnabled = automations.filter((a) => a.enabled).length;

  // Loyalty KPIs
  const loyaltyMembers = new Set(
    loyalty.map((l) => l.user_id).filter(Boolean),
  ).size;
  const loyaltyPoints = loyalty.reduce(
    (s, l) => s + (l.delta && l.delta > 0 ? l.delta : 0),
    0,
  );

  // Referral KPIs
  const referralsTotal = referrals.length;
  const referralsRewarded = referrals.filter(
    (r) => r.status === "rewarded",
  ).length;
  const referralsPending = referralsTotal - referralsRewarded;

  return (
    <div className="py-10">
      <Container>
        <PageHeader
          icon={TrendingUp}
          title={t.title}
          subtitle={t.subtitle}
        />

        {/* Coupons */}
        <section className="mt-2">
          <h2 className="mb-3 text-lg font-extrabold tracking-tight">
            {t.coupons}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label={t.total} value={num(couponsTotal)} />
            <Stat label={t.active} value={num(couponsActive)} />
            <Stat label={t.used} value={num(couponsUsed)} />
          </div>
          {coupons.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {coupons.slice(0, 12).map((c) => (
                <Card key={c.id}>
                  <CardBody className="flex flex-wrap items-center gap-3 p-3">
                    <span className="font-bold tabular-nums">
                      {c.code ?? "—"}
                    </span>
                    <span className="text-sm font-bold text-primary tabular-nums">
                      {couponValue(c)}
                    </span>
                    <Badge variant={c.is_active ? "success" : "neutral"} size="sm">
                      {c.is_active ? t.active : t.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {t.used}: {num(c.used_count ?? 0)}
                    </span>
                    <span className="ms-auto text-xs text-muted-foreground">
                      {t.store}: {c.stores?.name ?? "—"}
                    </span>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Campaigns */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-extrabold tracking-tight">
            {t.campaigns}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <Stat label={t.total} value={num(campaignsTotal)} />
            <Stat label={t.sent} value={num(campaignsSent)} />
          </div>
          {campaigns.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {campaigns.slice(0, 12).map((c) => (
                <Card key={c.id}>
                  <CardBody className="flex flex-wrap items-center gap-3 p-3">
                    <span className="font-bold">{c.title ?? "—"}</span>
                    {c.audience && (
                      <Badge variant="info" size="sm">
                        {c.audience}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {t.sent}: {num(c.sent_count ?? 0)}
                    </span>
                    <span className="ms-auto text-xs text-muted-foreground">
                      {t.store}: {c.stores?.name ?? "—"}
                    </span>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Automations */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-extrabold tracking-tight">
            {t.automations}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label={t.total} value={num(automationsTotal)} />
            <Stat label={t.active} value={num(automationsEnabled)} />
            <Stat label={t.runs} value={num(runsCount)} />
          </div>
          {automations.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {automations.slice(0, 12).map((a) => (
                <Card key={a.id}>
                  <CardBody className="flex flex-wrap items-center gap-3 p-3">
                    <span className="font-bold">{a.name ?? "—"}</span>
                    {a.trigger && (
                      <Badge variant="neutral" size="sm">
                        {t.trigger}: {a.trigger}
                      </Badge>
                    )}
                    <Badge variant={a.enabled ? "success" : "neutral"} size="sm">
                      {a.enabled ? t.active : t.status}
                    </Badge>
                    <span className="ms-auto text-xs text-muted-foreground">
                      {t.store}: {a.stores?.name ?? "—"}
                    </span>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Loyalty */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-extrabold tracking-tight">
            {t.loyalty}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <Stat label={t.members} value={num(loyaltyMembers)} />
            <Stat label={t.points} value={num(loyaltyPoints)} />
          </div>
          {loyalty.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">{t.empty}</p>
          )}
        </section>

        {/* Referrals */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-extrabold tracking-tight">
            {t.referrals}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label={t.total} value={num(referralsTotal)} />
            <Stat label={t.rewarded} value={num(referralsRewarded)} />
            <Stat label={t.pending} value={num(referralsPending)} />
          </div>
          {referrals.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">{t.empty}</p>
          )}
        </section>
      </Container>
    </div>
  );
}
