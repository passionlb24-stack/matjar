"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Check,
  X,
  Star,
  Trash2,
  ExternalLink,
  Tags,
  Flag,
  ImageIcon,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { Container } from "@/components/ui/container";

export type AdminListing = {
  id: string;
  title: string;
  price: number;
  city: string | null;
  region: string | null;
  status: "draft" | "pending" | "active" | "sold" | "rejected";
  isFeatured: boolean;
  image: string | null;
  storeName: string | null;
  views: number;
  createdAt: string;
};

const STATUS_TABS = [
  "all",
  "pending",
  "active",
  "rejected",
  "featured",
  "sold",
  "draft",
] as const;
type Tab = (typeof STATUS_TABS)[number];

const statusStyle: Record<AdminListing["status"], string> = {
  draft: "bg-zinc-100 text-zinc-600",
  pending: "bg-amber-100 text-amber-700",
  active: "bg-emerald-100 text-emerald-700",
  sold: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
};

function formatPrice(price: number) {
  return price >= 1000 ? `$${Number(price).toLocaleString("en-US")}` : `$${price}`;
}

export function AdminMarketClient({
  lang,
  dict,
  listings,
  openReports,
}: {
  lang: Locale;
  dict: Dictionary;
  listings: AdminListing[];
  openReports: number;
}) {
  const router = useRouter();
  const t = dict.admin.market;
  const [tab, setTab] = useState<Tab>("pending");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = {
      all: listings.length,
      pending: 0,
      active: 0,
      rejected: 0,
      featured: 0,
      sold: 0,
      draft: 0,
    };
    for (const l of listings) {
      if (l.status in c) c[l.status as Tab]++;
      if (l.isFeatured) c.featured++;
    }
    return c;
  }, [listings]);

  const totalViews = useMemo(
    () => listings.reduce((sum, l) => sum + (l.views || 0), 0),
    [listings],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return listings.filter((l) => {
      const matchTab =
        tab === "all"
          ? true
          : tab === "featured"
            ? l.isFeatured
            : l.status === tab;
      const matchQ = !query || l.title.toLowerCase().includes(query);
      return matchTab && matchQ;
    });
  }, [listings, tab, q]);

  async function patch(id: string, values: Partial<Record<string, unknown>>) {
    setBusyId(id);
    await createClient()
      .from("listings")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", id);
    setBusyId(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm(t.delete + "?")) return;
    setBusyId(id);
    await createClient().from("listings").delete().eq("id", id);
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="py-10">
      <Container>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
            <p className="mt-2 text-muted-foreground">{t.subtitle}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/${lang}/admin/market/categories`}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-surface-muted"
            >
              <Tags className="h-4 w-4" />
              {t.categoriesLink}
            </Link>
            <Link
              href={`/${lang}/admin/market/reports`}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-surface-muted"
            >
              <Flag className="h-4 w-4" />
              {t.reportsLink}
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              { label: t.allStatuses, value: counts.all },
              { label: t.statusLabels.active, value: counts.active },
              { label: t.statusLabels.pending, value: counts.pending },
              { label: t.featuredBadge, value: counts.featured },
              { label: t.statViews, value: totalViews },
              { label: t.statReports, value: openReports },
            ] as const
          ).map((s, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <div className="text-2xl font-extrabold text-primary">
                {s.value.toLocaleString("en-US")}
              </div>
              <div className="mt-1 text-xs font-semibold text-muted-foreground">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-1.5">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                tab === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all"
                ? t.allStatuses
                : s === "featured"
                  ? t.featuredBadge
                  : t.statusLabels[s as AdminListing["status"]]}
              <span className="ms-1.5 opacity-70">{counts[s]}</span>
            </button>
          ))}
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.search}
          className="mt-4 w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />

        <div className="mt-6 space-y-2">
          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
              {t.empty}
            </div>
          )}
          {filtered.map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-3"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                {l.image ? (
                  <Image
                    src={l.image}
                    alt=""
                    width={64}
                    height={64}
                    className="h-16 w-16 object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-black/10" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{l.title}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusStyle[l.status]}`}
                  >
                    {t.statusLabels[l.status]}
                  </span>
                  {l.isFeatured && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                      ★ {t.featuredBadge}
                    </span>
                  )}
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {l.storeName ? `${t.merchant} · ${l.storeName}` : t.user}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  <span className="font-bold text-primary">
                    {formatPrice(l.price)}
                  </span>
                  {(l.city || l.region) && (
                    <span>{[l.city, l.region].filter(Boolean).join("، ")}</span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <Link
                  href={`/${lang}/market/${l.id}`}
                  target="_blank"
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-surface-muted"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                {l.status !== "active" && (
                  <button
                    disabled={busyId === l.id}
                    onClick={() => patch(l.id, { status: "active" })}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {t.approve}
                  </button>
                )}
                {l.status !== "rejected" && (
                  <button
                    disabled={busyId === l.id}
                    onClick={() => patch(l.id, { status: "rejected" })}
                    className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t.reject}
                  </button>
                )}
                <button
                  disabled={busyId === l.id}
                  onClick={() => patch(l.id, { is_featured: !l.isFeatured })}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                    l.isFeatured
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-border hover:bg-surface-muted"
                  }`}
                >
                  <Star className="h-3.5 w-3.5" />
                  {l.isFeatured ? t.unfeature : t.feature}
                </button>
                <button
                  disabled={busyId === l.id}
                  onClick={() => remove(l.id)}
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
