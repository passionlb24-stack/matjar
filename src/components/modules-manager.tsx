"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { FeatureModuleKey } from "@/lib/modules-catalog";

export type ModuleItem = {
  key: FeatureModuleKey;
  tier: "free" | "pro";
  enabled: boolean;
};

// Per-store module toggles. The merchant sees their sector's capabilities and
// switches them on/off (Pro modules are locked on the free plan). Writes to
// store_modules; the public store page + dashboard read the resolved set.
export function ModulesManager({
  storeId,
  dict,
  items,
  isPro,
}: {
  storeId: string;
  dict: Dictionary;
  items: ModuleItem[];
  isPro: boolean;
}) {
  const router = useRouter();
  const t = dict.os.modules;
  const labels = t.labels as Record<string, string>;
  const [busy, setBusy] = useState<string | null>(null);
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((i) => [i.key, i.enabled])),
  );

  async function toggle(item: ModuleItem, next: boolean) {
    if (item.tier === "pro" && !isPro && next) return; // can't enable Pro on free
    setBusy(item.key);
    setState((s) => ({ ...s, [item.key]: next }));
    const { error } = await createClient()
      .from("store_modules")
      .upsert(
        { store_id: storeId, module_key: item.key, enabled: next },
        { onConflict: "store_id,module_key" },
      );
    setBusy(null);
    if (error) {
      setState((s) => ({ ...s, [item.key]: !next }));
      return;
    }
    router.refresh();
  }

  function Row({ item }: { item: ModuleItem }) {
    const on = state[item.key];
    const locked = item.tier === "pro" && !isPro;
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold">{labels[item.key] ?? item.key}</span>
            {item.tier === "pro" && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-warning">
                Pro
              </span>
            )}
          </div>
          {locked && (
            <p className="mt-0.5 text-xs text-muted-foreground">{t.proNote}</p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={labels[item.key] ?? item.key}
          disabled={busy === item.key || locked}
          onClick={() => toggle(item, !on)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            on ? "bg-primary" : "bg-surface-muted"
          }`}
        >
          <span
            className={`absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow transition-all ${
              on ? "end-0.5" : "start-0.5"
            }`}
          >
            {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
          </span>
        </button>
      </div>
    );
  }

  const active = items.filter((i) => state[i.key]);
  const available = items.filter((i) => !state[i.key]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t.active}
        </h2>
        <div className="space-y-2">
          {active.map((i) => (
            <Row key={i.key} item={i} />
          ))}
        </div>
      </div>
      {available.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t.available}
          </h2>
          <div className="space-y-2">
            {available.map((i) => (
              <Row key={i.key} item={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
