"use client";

import { Trash2, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Action } from "../automation-manager";

export function ActionEditor({
  action: a,
  Icon: AIcon,
  tint,
  t,
  onFieldChange,
  onRemove,
}: {
  action: Action;
  Icon: LucideIcon;
  tint: string;
  t: Dictionary["os"]["automations"];
  onFieldChange: (patch: Partial<Action>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-muted/40 p-3">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${tint}`}
        >
          <AIcon className="h-4 w-4" />
        </span>
        <span className="flex-1 text-sm font-bold">{t.actions[a.type]}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t.delete}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 ps-9 text-xs text-muted-foreground">
        {t.actionHint[a.type]}
      </p>
      <div className="mt-2 ps-9">
        {a.type === "notify" && (
          <div className="grid gap-2">
            <input
              value={a.title}
              onChange={(e) => onFieldChange({ title: e.target.value })}
              placeholder={t.params.notifyTitle}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <textarea
              value={a.body}
              onChange={(e) => onFieldChange({ body: e.target.value })}
              placeholder={t.params.notifyBody}
              rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        )}
        {a.type === "whatsapp" && (
          <textarea
            value={a.message}
            onChange={(e) => onFieldChange({ message: e.target.value })}
            placeholder={t.params.whatsappMessage}
            rows={3}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
        )}
        {a.type === "loyalty" && (
          <label className="text-xs font-semibold text-muted-foreground">
            {t.params.loyaltyPoints}
            <input
              type="number"
              min="0"
              value={a.points}
              onChange={(e) =>
                onFieldChange({
                  points: Number(e.target.value),
                })
              }
              dir="ltr"
              className="mt-1 block w-28 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
        )}
        {a.type === "coupon" && (
          <label className="text-xs font-semibold text-muted-foreground">
            {t.params.couponPercent}
            <input
              type="number"
              min="0"
              max="100"
              value={a.percent}
              onChange={(e) =>
                onFieldChange({
                  percent: Number(e.target.value),
                })
              }
              dir="ltr"
              className="mt-1 block w-28 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
        )}
      </div>
    </div>
  );
}
