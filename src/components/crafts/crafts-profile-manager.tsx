"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MapPin, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";
import { Button } from "@/components/ui/button";

export type TradeOption = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  icon: string | null;
  group_slug: string;
};
export type GroupOption = {
  slug: string;
  name_ar: string;
  name_en: string;
  icon: string | null;
};
export type AreaOption = {
  id: string;
  slug: string;
  region: string;
  name_ar: string;
  name_en: string;
};

// Two answers that decide whether this business is findable at all: what they
// do, and where they will travel to.
//
// Both are stored as sets rather than a single value on the store, because
// neither is singular in real life — an electrician who also installs AC is
// normal, and a plumber covers a handful of towns rather than sitting at one
// address. browse_crafts filters on exactly these two.
//
// Saved by replacing the whole set rather than diffing: the sets are tiny, the
// rows carry nothing but the link itself, and there is no id anywhere else to
// invalidate — unlike product variants, where the same shortcut broke live
// orders.
export function CraftsProfileManager({
  storeId,
  lang,
  groups,
  trades,
  areas,
  initialTradeIds,
  initialAreaIds,
  labels,
}: {
  storeId: string;
  lang: string;
  groups: GroupOption[];
  trades: TradeOption[];
  areas: AreaOption[];
  initialTradeIds: string[];
  initialAreaIds: string[];
  labels: {
    title: string;
    body: string;
    tradesLabel: string;
    areasLabel: string;
    save: string;
    saving: string;
    saved: string;
    needTrade: string;
    error: string;
    regions: Record<string, string>;
  };
}) {
  const router = useRouter();
  const ar = lang === "ar";
  const [pickedTrades, setPickedTrades] = useState<Set<string>>(
    new Set(initialTradeIds),
  );
  const [pickedAreas, setPickedAreas] = useState<Set<string>>(
    new Set(initialAreaIds),
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function toggle(set: Set<string>, id: string, apply: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
    setDone(false);
  }

  const byRegion = areas.reduce<Record<string, AreaOption[]>>((acc, a) => {
    (acc[a.region] ??= []).push(a);
    return acc;
  }, {});

  async function save() {
    // A provider with no trade cannot appear anywhere, so refuse rather than
    // save a profile that quietly will not be found.
    if (pickedTrades.size === 0) {
      notifyError(labels.needTrade);
      return;
    }
    setBusy(true);
    const supabase = createClient();

    await supabase.from("store_trades").delete().eq("store_id", storeId);
    if (pickedTrades.size) {
      const { error } = await supabase.from("store_trades").insert(
        [...pickedTrades].map((trade_id) => ({ store_id: storeId, trade_id })),
      );
      if (error) {
        setBusy(false);
        notifyError(labels.error);
        return;
      }
    }

    await supabase.from("store_service_areas").delete().eq("store_id", storeId);
    if (pickedAreas.size) {
      const { error } = await supabase.from("store_service_areas").insert(
        [...pickedAreas].map((area_id) => ({ store_id: storeId, area_id })),
      );
      if (error) {
        setBusy(false);
        notifyError(labels.error);
        return;
      }
    }

    setBusy(false);
    setDone(true);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <Wrench className="h-4 w-4 text-primary" />
        {labels.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{labels.body}</p>

      <div className="mt-5">
        <span className="text-sm font-semibold">{labels.tradesLabel}</span>
        <div className="mt-2 space-y-3">
          {groups.map((g) => {
            const list = trades.filter((t) => t.group_slug === g.slug);
            if (!list.length) return null;
            return (
              <div key={g.slug}>
                <p className="text-xs font-bold text-muted-foreground">
                  {g.icon} {ar ? g.name_ar : g.name_en}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {list.map((t) => {
                    const on = pickedTrades.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggle(pickedTrades, t.id, setPickedTrades)}
                        aria-pressed={on}
                        className={`rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition-colors ${
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-surface hover:border-primary/40"
                        }`}
                      >
                        <span aria-hidden className="me-1">
                          {t.icon}
                        </span>
                        {ar ? t.name_ar : t.name_en}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {labels.areasLabel}
        </span>
        <div className="mt-2 space-y-3">
          {Object.entries(byRegion).map(([region, list]) => (
            <div key={region}>
              <p className="text-xs font-bold text-muted-foreground">
                {labels.regions[region] ?? region}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {list.map((a) => {
                  const on = pickedAreas.has(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggle(pickedAreas, a.id, setPickedAreas)}
                      aria-pressed={on}
                      className={`rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition-colors ${
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-surface hover:border-primary/40"
                      }`}
                    >
                      {ar ? a.name_ar : a.name_en}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={save} loading={busy}>
          {busy ? labels.saving : labels.save}
        </Button>
        {done && (
          <span className="flex items-center gap-1 text-sm font-semibold text-success">
            <Check className="h-4 w-4" />
            {labels.saved}
          </span>
        )}
      </div>
    </div>
  );
}
