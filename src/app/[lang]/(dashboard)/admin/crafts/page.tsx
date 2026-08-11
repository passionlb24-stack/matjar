import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Wrench } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { requireAdminSection } from "@/lib/admin-guard";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminCraftActions } from "@/components/admin-craft-actions";

type ProviderRow = {
  id: string;
  name: string;
  headline: string | null;
  photo_url: string | null;
  kind: string;
  phone: string | null;
  years_experience: number | null;
  status: string;
  verified: boolean;
  rating_count: number;
  completed_count: number;
  created_at: string;
  craft_provider_trades: { trades: { name_ar: string; name_en: string } | null }[];
  craft_provider_areas: { lb_areas: { name_ar: string; name_en: string } | null }[];
};

const TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  pending: "warning",
  rejected: "danger",
  suspended: "neutral",
};

// Moderation for the crafts directory.
//
// Pending first, and deliberately not filtered away afterwards: the queue is
// the only thing standing between this directory and whoever wants to be in it,
// so it has to be the first thing on the page and it has to show everything
// that is waiting.
export default async function AdminCraftsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireAdminSection("crafts", lang);
  const dict = await getDictionary(lang);
  const t = dict.crafts;
  const ar = lang === "ar";

  const supabase = await createClient();
  const { data } = await supabase
    .from("craft_providers")
    .select(
      `id, name, headline, photo_url, kind, phone, years_experience, status,
       verified, rating_count, completed_count, created_at,
       craft_provider_trades(trades(name_ar, name_en)),
       craft_provider_areas(lb_areas(name_ar, name_en))`,
    )
    // Pending to the top; newest first inside each group.
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as ProviderRow[];
  const pending = rows.filter((r) => r.status === "pending");

  return (
    <div className="py-10">
      <Container>
        <PageHeader
          icon={Wrench}
          title={t.adminTitle}
          subtitle={t.adminSubtitle
            .replace("{total}", String(rows.length))
            .replace("{pending}", String(pending.length))}
        />

        {rows.length === 0 ? (
          <EmptyState icon={Wrench} title={t.adminEmpty} />
        ) : (
          <Card data-animate>
            <div className="divide-y divide-border">
              {rows.map((r) => {
                const trades = r.craft_provider_trades
                  .map((x) => x.trades)
                  .filter(Boolean) as { name_ar: string; name_en: string }[];
                const areas = r.craft_provider_areas
                  .map((x) => x.lb_areas)
                  .filter(Boolean) as { name_ar: string; name_en: string }[];
                return (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-start justify-between gap-4 p-4 transition-colors hover:bg-surface-muted"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {r.photo_url ? (
                        <Image
                          src={r.photo_url}
                          alt=""
                          width={48}
                          height={48}
                          className="h-12 w-12 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                          <Wrench className="h-5 w-5" />
                        </span>
                      )}

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/${lang}/crafts/p/${r.id}`}
                            className="font-semibold hover:text-primary"
                          >
                            {r.name}
                          </Link>
                          <Badge variant={TONE[r.status] ?? "neutral"} size="sm">
                            {(t.adminStatuses as unknown as Record<string, string>)[
                              r.status
                            ] ?? r.status}
                          </Badge>
                          {r.verified && (
                            <Badge variant="primary" size="sm">
                              {t.verified}
                            </Badge>
                          )}
                          {r.kind === "business" && (
                            <Badge variant="neutral" size="sm">
                              {t.kindBusiness}
                            </Badge>
                          )}
                        </div>

                        {r.headline && (
                          <p className="truncate text-sm text-muted-foreground">
                            {r.headline}
                          </p>
                        )}

                        {/* What the admin is actually judging: does this person
                            claim a real trade, in real places, reachable. */}
                        <p className="text-xs text-muted-foreground">
                          {trades
                            .map((x) => (ar ? x.name_ar : x.name_en))
                            .join("، ") || "—"}
                          {" · "}
                          {areas.length
                            ? areas
                                .slice(0, 4)
                                .map((x) => (ar ? x.name_ar : x.name_en))
                                .join("، ")
                            : "—"}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          <span dir="ltr">{r.phone ?? "—"}</span>
                          {(r.years_experience ?? 0) > 0 &&
                            ` · ${r.years_experience} ${t.years}`}
                          {` · ${r.completed_count} ${t.adminDone}`}
                        </p>
                      </div>
                    </div>

                    <AdminCraftActions
                      providerId={r.id}
                      status={r.status}
                      verified={r.verified}
                      labels={{
                        approve: t.adminApprove,
                        reject: t.adminReject,
                        suspend: t.adminSuspend,
                        restore: t.adminApprove,
                        verify: t.adminVerify,
                        unverify: t.adminUnverify,
                        confirmReject: t.adminConfirmReject,
                        confirmSuspend: t.adminConfirmSuspend,
                        confirm: dict.common.confirm,
                        cancel: dict.common.cancel,
                        error: dict.auth.errorGeneric,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </Container>
    </div>
  );
}
