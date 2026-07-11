"use client";

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
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { regions } from "@/lib/catalog";
import { Container } from "@/components/ui/container";

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

const statusStyle: Record<AdminStore["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  active: "bg-emerald-100 text-emerald-700",
  suspended: "bg-red-100 text-red-700",
  rejected: "bg-zinc-200 text-zinc-600",
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
      window.alert(dict.auth.errorGeneric);
      return;
    }
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

  return (
    <div className="py-10">
      <Container>
        <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>

        <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-surface px-4 sm:max-w-md">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
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

        <p className="mt-6 text-sm text-muted-foreground">{filtered.length}</p>

        {filtered.length ? (
          <div className="mt-2 space-y-3">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{s.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusStyle[s.status]}`}
                    >
                      {t.statusLabels[s.status]}
                    </span>
                    {s.isVerified && (
                      <BadgeCheck className="h-4 w-4 text-primary" />
                    )}
                    {s.plan === "pro" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                        Pro
                      </span>
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

                <div className="flex flex-wrap gap-2">
                  {s.status === "pending" && (
                    <>
                      <button
                        disabled={busy === s.id}
                        onClick={() => patch(s.id, { status: "active" })}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Check className="h-4 w-4" />
                        {dict.admin.approve}
                      </button>
                      <button
                        disabled={busy === s.id}
                        onClick={() => patch(s.id, { status: "rejected" })}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                      >
                        <X className="h-4 w-4" />
                        {dict.admin.reject}
                      </button>
                    </>
                  )}
                  {s.status === "active" && (
                    <button
                      disabled={busy === s.id}
                      onClick={() => patch(s.id, { status: "suspended" })}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                    >
                      <Ban className="h-4 w-4" />
                      {t.suspend}
                    </button>
                  )}
                  {(s.status === "suspended" || s.status === "rejected") && (
                    <button
                      disabled={busy === s.id}
                      onClick={() => patch(s.id, { status: "active" })}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <Play className="h-4 w-4" />
                      {t.activate}
                    </button>
                  )}
                  <button
                    disabled={busy === s.id}
                    onClick={() => patch(s.id, { is_verified: !s.isVerified })}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-surface-muted disabled:opacity-60"
                  >
                    <BadgeCheck className="h-4 w-4" />
                    {s.isVerified ? t.unverify : t.verify}
                  </button>
                  <button
                    disabled={busy === s.id}
                    onClick={() =>
                      patch(s.id, {
                        plan: s.plan === "pro" ? "free" : "pro",
                        is_verified: s.plan === "pro" ? s.isVerified : true,
                      })
                    }
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-60 ${
                      s.plan === "pro"
                        ? "border border-border text-muted-foreground hover:bg-surface-muted"
                        : "bg-amber-500 text-white hover:bg-amber-600"
                    }`}
                  >
                    <Crown className="h-4 w-4" />
                    {s.plan === "pro" ? dict.admin.makeFree : dict.admin.makePro}
                  </button>
                  {(() => {
                    const featured =
                      s.featuredUntil != null &&
                      new Date(s.featuredUntil) > new Date();
                    return (
                      <button
                        disabled={busy === s.id}
                        onClick={() =>
                          patch(s.id, {
                            featured_until: featured
                              ? null
                              : new Date(
                                  Date.now() + 30 * 24 * 60 * 60 * 1000,
                                ).toISOString(),
                          })
                        }
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-60 ${
                          featured
                            ? "border border-border text-muted-foreground hover:bg-surface-muted"
                            : "bg-amber-500 text-white hover:bg-amber-600"
                        }`}
                      >
                        <Sparkles className="h-4 w-4" />
                        {featured ? dict.admin.unfeature : dict.admin.feature}
                      </button>
                    );
                  })()}
                  {s.commercialRegNo && (
                    <button
                      disabled={busy === s.id}
                      onClick={() =>
                        patch(s.id, {
                          commercial_reg_verified: !s.commercialRegVerified,
                        })
                      }
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-60 ${
                        s.commercialRegVerified
                          ? "border border-border text-muted-foreground hover:bg-surface-muted"
                          : "bg-primary text-primary-foreground hover:bg-primary-hover"
                      }`}
                    >
                      <Landmark className="h-4 w-4" />
                      {s.commercialRegVerified
                        ? dict.admin.unverifyReg
                        : dict.admin.verifyReg}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
            {t.empty}
          </div>
        )}
      </Container>
    </div>
  );
}
