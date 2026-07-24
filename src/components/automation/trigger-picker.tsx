"use client";

import type { LucideIcon } from "lucide-react";
import type { TriggerKey } from "../automation-manager";

export function TriggerPicker({
  value,
  items,
  onSelect,
}: {
  value: TriggerKey;
  items: { tr: TriggerKey; Icon: LucideIcon; label: string }[];
  onSelect: (tr: TriggerKey) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map(({ tr, Icon: TrIcon, label }) => {
        const active = value === tr;
        return (
          <button
            key={tr}
            type="button"
            onClick={() => onSelect(tr)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-start text-sm font-semibold transition-all ${
              active
                ? "border-primary bg-primary-soft text-primary shadow-sm"
                : "border-border bg-surface text-foreground hover:border-primary/40"
            }`}
          >
            <TrIcon
              className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
            />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
