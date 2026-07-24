"use client";

import {
  ChevronRight,
  Filter,
  Pencil,
  Trash2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { AutomationRow } from "../automation-manager";

export function AutomationListItem({
  a,
  t,
  TriggerIcon,
  chips,
  actionChips,
  busy,
  onToggle,
  onEdit,
  onRemove,
}: {
  a: AutomationRow;
  t: Dictionary["os"]["automations"];
  TriggerIcon: LucideIcon;
  chips: string[];
  actionChips: { tint: string; Icon: LucideIcon; label: string }[];
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border bg-surface p-4 transition-colors ${
        a.enabled ? "border-border" : "border-border/60 opacity-70"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            a.enabled
              ? "bg-primary-soft text-primary"
              : "bg-surface-muted text-muted-foreground"
          }`}
        >
          <Zap className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">
              {a.name?.trim() || t.triggers[a.trigger]}
            </span>
            {!a.enabled && (
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                {t.pausedLabel}
              </span>
            )}
          </div>
          {/* summary chips */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 font-bold text-primary">
              <TriggerIcon className="h-3 w-3" />
              {t.triggers[a.trigger]}
            </span>
            {chips.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 font-semibold text-warning"
              >
                <Filter className="h-3 w-3" />
                {c}
              </span>
            ))}
            <ChevronRight className="h-3 w-3 text-muted-foreground rtl:rotate-180" />
            {actionChips.map((chip, i) => {
              const ChipIcon = chip.Icon;
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${chip.tint}`}
                >
                  <ChipIcon className="h-3 w-3" />
                  {chip.label}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* enable/disable switch */}
          <button
            type="button"
            role="switch"
            aria-checked={a.enabled}
            aria-label={a.enabled ? t.toggleOff : t.toggleOn}
            title={a.enabled ? t.toggleOff : t.toggleOn}
            disabled={busy}
            onClick={onToggle}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
              a.enabled ? "bg-primary" : "bg-border"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                a.enabled ? "start-[22px]" : "start-0.5"
              }`}
            />
          </button>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-1 border-t border-border pt-2">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
          {t.edit}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
        >
          <Trash2 className="h-4 w-4" />
          {t.delete}
        </button>
      </div>
    </div>
  );
}
