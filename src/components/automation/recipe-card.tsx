"use client";

import { Check, Zap, type LucideIcon } from "lucide-react";

export function RecipeCard({
  Icon,
  tint,
  name,
  desc,
  added,
  pending,
  addedLabel,
  enableLabel,
  onEnable,
}: {
  Icon: LucideIcon;
  tint: string;
  name: string;
  desc: string;
  added: boolean;
  pending: boolean;
  addedLabel: string;
  enableLabel: string;
  onEnable: () => void;
}) {
  return (
    <div className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-all hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${tint}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-tight">{name}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {desc}
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={added || pending}
        onClick={onEnable}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
          added
            ? "cursor-default bg-success-soft text-success"
            : "bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        }`}
      >
        {added ? (
          <>
            <Check className="h-4 w-4" />
            {addedLabel}
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            {enableLabel}
          </>
        )}
      </button>
    </div>
  );
}
