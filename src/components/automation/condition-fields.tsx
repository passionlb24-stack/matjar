"use client";

import { BadgeDollarSign, Clock, MapPin, Moon, Star } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Draft, LocationOption } from "../automation-manager";

type CondFlags = {
  minTotal?: boolean;
  location?: boolean;
  maxRating?: boolean;
  hoursBefore?: boolean;
  inactiveDays?: boolean;
};

export function ConditionFields({
  flags,
  showLocation,
  hasAnyCond,
  draft,
  locations,
  t,
  onDraftChange,
}: {
  flags: CondFlags;
  showLocation: boolean;
  hasAnyCond: boolean;
  draft: Draft;
  locations: LocationOption[];
  t: Dictionary["os"]["automations"];
  onDraftChange: (patch: Partial<Draft>) => void;
}) {
  return hasAnyCond ? (
    <div className="grid gap-3 sm:grid-cols-2">
      {flags.minTotal && (
        <label className="text-sm font-semibold">
          <span className="flex items-center gap-1">
            <BadgeDollarSign className="h-4 w-4 text-muted-foreground" />
            {t.conditions.minTotal}
          </span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={draft.minTotal}
            onChange={(e) => onDraftChange({ minTotal: e.target.value })}
            placeholder="—"
            dir="ltr"
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </label>
      )}
      {showLocation && (
        <label className="text-sm font-semibold">
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            {t.conditions.location}
          </span>
          <select
            value={draft.locationId}
            onChange={(e) => onDraftChange({ locationId: e.target.value })}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            <option value="">{t.conditions.anyLocation}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name?.trim() || l.region || l.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
      )}
      {flags.maxRating && (
        <label className="text-sm font-semibold sm:col-span-2">
          <span className="flex items-center gap-1">
            <Star className="h-4 w-4 text-muted-foreground" />
            {t.conditions.maxRating}
          </span>
          <select
            value={draft.maxRating}
            onChange={(e) => onDraftChange({ maxRating: e.target.value })}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            <option value="">{t.conditions.anyLocation}</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}★
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            {t.conditions.maxRatingHint}
          </span>
        </label>
      )}
      {flags.hoursBefore && (
        <label className="text-sm font-semibold sm:col-span-2">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {t.conditions.hoursBefore}
          </span>
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={draft.hoursBefore}
            onChange={(e) => onDraftChange({ hoursBefore: e.target.value })}
            placeholder="1"
            dir="ltr"
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            {t.conditions.hoursBeforeHint}
          </span>
        </label>
      )}
      {flags.inactiveDays && (
        <label className="text-sm font-semibold sm:col-span-2">
          <span className="flex items-center gap-1">
            <Moon className="h-4 w-4 text-muted-foreground" />
            {t.conditions.inactiveDays}
          </span>
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={draft.inactiveDays}
            onChange={(e) => onDraftChange({ inactiveDays: e.target.value })}
            placeholder="30"
            dir="ltr"
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            {t.conditions.inactiveDaysHint}
          </span>
        </label>
      )}
    </div>
  ) : (
    <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
      {t.conditions.none}
    </p>
  );
}
