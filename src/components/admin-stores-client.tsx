"use client";
import { notifyError } from "@/lib/notify";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Check,
  X,
  Ban,
  Play,
  BadgeCheck,
  Crown,
  Sparkles,
  Landmark,
  Store as StoreIcon,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { revalidateStores } from "@/lib/cache-actions";
import { logAdminAction, type AuditVerb } from "@/lib/audit";
import { regions } from "@/lib/catalog";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { OverflowMenu, type OverflowAction } from "@/components/overflow-menu";

export type AdminStore = {
  id: string;
  name: string;
  region: string | null;
  status: "pending" | "active" | "suspended" | "rejected";
  plan: "free" | "pro";
  isVerified: boolean;
  featuredUntil: string | null;
  commercialRegNo: string | null;
  commercialRegVerified: boolean;
  typeName: string | null;
  ownerName: string | null;
};

const statusVariant: Record<
  AdminStore["status"],
  "neutral" | "success" | "warning" | "danger"
> = {
  pending: "warning",
  active: "success",
  suspended: "danger",
  rejected: "neutral",
};

function chip(active: boolean) {
  return active
    ? "bg-primary text-primary-foreground border-primary"
    : "bg-surface text-foreground border-border hover:border-primary/40";
}

export function AdminStoresClient({
  lang,
  dict,
  stores,
}: {
  lang: Locale;
  dict: Dictionary;
  stores: AdminStore[];
}) {
  const router = useRouter();
  const t = dict.admin.storesAdmin;
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AdminStore["status"] | "all">("all");
  const [region, setRegion] = useState<string | "all">("all");

  async function patch(id: string, patch: Record<string, unknown>) {
    setBusy(id);
    const { error } = await createClient()
      .from("stores")
      .update(patch)
      .eq("id", id);
    setBusy(null);
    if (error) {
      notifyError(dict.auth.errorGeneric);
      return;
    }
    let verb: AuditVerb;
    if (patch.status) verb = "status_changed";
    else if ("plan" in patch) verb = "plan_changed";
    else if ("is_verified" in patch)
      verb = patch.is_verified ? "verified" : "unverified";
    else if ("featured_until" in patch)
      verb = patch.featured_until ? "featured" : "unfeatured";
    else if ("commercial_reg_verified" in patch)
      verb = patch.commercial_reg_verified ? "verified" : "unverified";
    else verb = "updated";
    void logAdminAction(verb, "store", id, patch);
    await revalidateStores();
    router.refresh();
  }

  const filtered = stores.filter((s) => {
    if (status !== "all" && s.status !== status) return false;
    if (region !== "all" && s.region !== region) return false;
    if (query.trim() && !s.name.toLowerCase().includes(query.trim().toLowerCase()))
      return false;
    return true;
  });

  const statuses: (AdminStore["status"] | "all")[] = [
    "all",
    "pending",
    "active",
    "suspended",
    "rejected",
  ];

  const initial = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="py-10">
      <Container>
        <PageHeader icon={StoreIcon} title={t.title} subtitle={t.subtitle} />

        <div className="relative sm:max-w-md">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            className="ps-10"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${chip(status === s)}`}
            >
              {s === "all" ? t.allStatuses : t.statusLabels[s]}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setRegion("all")}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${chip(region === "all")}`}
          >
            {t.allRegions}
          </button>
          {regions.map((r) => (
            <button
              key={r.key}
              onClick={() => setRegion(r.key)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${chip(region === r.key)}`}
            >
              {r.name[lang]}
            </button>
          ))}
        </div>

        <p className="mt-6 text-sm font-semibold text-muted-foreground">
          {filtered.length}
        </p>

        {filtered.length ? (
          <div data-animate className="mt-2 space-y-3">
            {filtered.map((s) => (
              <Card key={s.id}>
                <CardBody className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-base font-extrabold text-primary">
                    {initial(s.name)}
                  </span>
                  <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{s.name}</h3>
                    <Badge variant={statusVariant[s.status]} size="sm">
                      {t.statusLabels[s.status]}
                    </Badge>
                    {s.isVerified && (
                      <Badge variant="primary" size="sm">
                        <BadgeCheck className="h-3 w-3" />
                      </Badge>
                    )}
                    {s.plan === "pro" && (
                      <Badge variant="warning" size="sm">
                        <Crown className="h-3 w-3" />
                        Pro
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {s.typeName}
                    {s.ownerName ? ` · ${t.owner}: ${s.ownerName}` : null}
                  </p>
                  {s.commercialRegNo && (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm">
                      <Landmark className="h-3.5 w-3.5 text-primary" />
                      <span className="font-semibold">{dict.admin.reg}:</span>
                      <span dir="ltr" className="font-mono">
                        {s.commercialRegNo}
                      </span>
                      {s.commercialRegVerified && (
                        <BadgeCheck className="h-4 w-4 text-primary" />
                      )}
                    </p>
                  )}
                  </div>
                </div>

                {(() => {
                  const featured =
                    s.featuredUntil != null &&
                    new Date(s.featuredUntil) > new Date();
                  const menuActions: OverflowAction[] = [
                    {
                      label: s.isVerified ? t.unverify : t.verify,
                      Icon: BadgeCheck,
                      active: s.isVerified,
                      disabled: busy === s.id,
                      onClick: () =>
                        patch(s.id, { is_verified: !s.isVerified }),
                    },
                    {
                      label:
                        s.plan === "pro"
                          ? dict.admin.makeFree
                          : dict.admin.makePro,
                      Icon: Crown,
                      active: s.plan === "pro",
                      disabled: busy === s.id,
                      onClick: () => {
                        if (
                          s.plan === "pro" &&
                          !window.confirm(dict.admin.confirmDowngrade)
                        )
                          return;
                        patch(s.id, {
                          plan: s.plan === "pro" ? "free" : "pro",
                          is_verified: s.plan === "pro" ? s.isVerified : true,
                        });
                      },
                    },
                    {
                      label: featured
                        ? dict.admin.unfeature
                        : dict.admin.feature,
                      Icon: Sparkles,
                      active: featured,
                      disabled: busy === s.id,
                      onClick: () =>
                        patch(s.id, {
                          featured_until: featured
                            ? null
                            : new Date(
                                Date.now() + 30 * 24 * 60 * 60 * 1000,
                              ).toISOString(),
                        }),
                    },
                  ];
                  if (s.commercialRegNo) {
                    menuActions.push({
                      label: s.commercialRegVerified
                        ? dict.admin.unverifyReg
                        : dict.admin.verifyReg,
                      Icon: Landmark,
                      active: s.commercialRegVerified,
                      disabled: busy === s.id,
                      onClick: () =>
                        patch(s.id, {
                          commercial_reg_verified: !s.commercialRegVerified,
                        }),
                    });
                  }
                  return (
                    <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                      {s.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            disabled={busy === s.id}
                            onClick={() => patch(s.id, { status: "active" })}
                            leftIcon={<Check className="h-4 w-4" />}
                          >
                            {dict.admin.approve}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy === s.id}
                            onClick={() => {
                              if (window.confirm(dict.admin.confirmReject))
                                patch(s.id, { status: "rejected" });
                            }}
                            leftIcon={<X className="h-4 w-4" />}
                            className="!text-danger"
                          >
                            {dict.admin.reject}
                          </Button>
                        </>
                      )}
                      {s.status === "active" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy === s.id}
                          onClick={() => {
                            if (window.confirm(dict.admin.confirmSuspend))
                              patch(s.id, { status: "suspended" });
                          }}
                          leftIcon={<Ban className="h-4 w-4" />}
                          className="!text-danger"
                        >
                          {t.suspend}
                        </Button>
                      )}
                      {(s.status === "suspended" ||
                        s.status === "rejected") && (
                        <Button
                          size="sm"
                          disabled={busy === s.id}
                          onClick={() => patch(s.id, { status: "active" })}
                          leftIcon={<Play className="h-4 w-4" />}
                        >
                          {t.activate}
                        </Button>
                      )}
                      <OverflowMenu
                        actions={menuActions}
                        label={dict.admin.moreActions}
                        disabled={busy === s.id}
                      />
                    </div>
                  );
                })()}
                </CardBody>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon={StoreIcon} title={t.empty} />
        )}
      </Container>
    </div>
  );
}
