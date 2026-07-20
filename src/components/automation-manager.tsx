"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  Filter,
  Play,
  Plus,
  Trash2,
  Pencil,
  Check,
  Bell,
  MessageCircle,
  Sparkles,
  Ticket,
  ShoppingBag,
  ShoppingCart,
  PackageCheck,
  PackageX,
  Star,
  Wallet,
  BadgeDollarSign,
  AlertTriangle,
  Wand2,
  ChevronRight,
  MapPin,
  Clock,
  CalendarClock,
  UserX,
  Moon,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { notifyError, notifySuccess } from "@/lib/notify";

// ===== Contract (fixed vocabulary — matches migration 0117) =====
export type TriggerKey =
  | "order_created"
  | "order_completed"
  | "order_abandoned"
  | "low_stock"
  | "new_review"
  | "payment_recorded"
  | "booking_reminder"
  | "customer_inactive";

export type ActionType = "notify" | "whatsapp" | "loyalty" | "coupon";

export type Conditions = {
  min_total?: number;
  location_id?: string;
  max_rating?: number;
  hours_before?: number;
  inactive_days?: number;
};

export type Action =
  | { type: "notify"; title: string; body: string }
  | { type: "whatsapp"; message: string }
  | { type: "loyalty"; points: number }
  | { type: "coupon"; percent: number };

export type AutomationRow = {
  id: string;
  name: string | null;
  trigger: TriggerKey;
  conditions: Conditions | null;
  actions: Action[] | null;
  enabled: boolean;
  created_at: string;
};

export type RunRow = {
  id: string;
  automation_id: string | null;
  trigger: string;
  status: "fired" | "skipped" | "error";
  detail: Record<string, unknown> | null;
  created_at: string;
};

export type LocationOption = {
  id: string;
  name: string | null;
  region: string | null;
};

const TRIGGERS: TriggerKey[] = [
  "order_created",
  "order_completed",
  "order_abandoned",
  "low_stock",
  "new_review",
  "payment_recorded",
  "booking_reminder",
  "customer_inactive",
];

const TRIGGER_ICON: Record<TriggerKey, LucideIcon> = {
  order_created: ShoppingBag,
  order_completed: PackageCheck,
  order_abandoned: ShoppingCart,
  low_stock: PackageX,
  new_review: Star,
  payment_recorded: Wallet,
  booking_reminder: CalendarClock,
  customer_inactive: UserX,
};

// Which optional conditions make sense per trigger.
const TRIGGER_CONDS: Record<
  TriggerKey,
  {
    minTotal?: boolean;
    location?: boolean;
    maxRating?: boolean;
    hoursBefore?: boolean;
    inactiveDays?: boolean;
  }
> = {
  order_created: { minTotal: true, location: true },
  order_completed: { minTotal: true, location: true },
  order_abandoned: {},
  low_stock: { location: true },
  new_review: { maxRating: true },
  payment_recorded: { minTotal: true, location: true },
  booking_reminder: { hoursBefore: true },
  customer_inactive: { inactiveDays: true },
};

const ACTION_TYPES: ActionType[] = ["notify", "whatsapp", "loyalty", "coupon"];

const ACTION_ICON: Record<ActionType, LucideIcon> = {
  notify: Bell,
  whatsapp: MessageCircle,
  loyalty: Sparkles,
  coupon: Ticket,
};

// Per-action-type accent (used on chips + node tints). Kept as full class strings
// so Tailwind's JIT picks them up.
const ACTION_TINT: Record<ActionType, string> = {
  notify: "bg-info-soft text-info",
  whatsapp: "bg-success-soft text-success",
  loyalty: "bg-primary-soft text-primary",
  coupon: "bg-warning-soft text-warning",
};

function defaultAction(type: ActionType): Action {
  switch (type) {
    case "notify":
      return { type: "notify", title: "", body: "" };
    case "whatsapp":
      return { type: "whatsapp", message: "" };
    case "loyalty":
      return { type: "loyalty", points: 10 };
    case "coupon":
      return { type: "coupon", percent: 10 };
  }
}

function timeAgo(iso: string, lang: Locale) {
  const diff = Date.now() - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat(lang === "ar" ? "ar" : "en", {
    numeric: "auto",
  });
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 1) return rtf.format(0, "minute");
  if (Math.abs(mins) < 60) return rtf.format(-mins, "minute");
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return rtf.format(-hrs, "hour");
  const days = Math.round(hrs / 24);
  if (Math.abs(days) < 30) return rtf.format(-days, "day");
  const months = Math.round(days / 30);
  return rtf.format(-months, "month");
}

type Draft = {
  name: string;
  trigger: TriggerKey;
  minTotal: string;
  locationId: string;
  maxRating: string;
  hoursBefore: string;
  inactiveDays: string;
  actions: Action[];
};

const emptyDraft: Draft = {
  name: "",
  trigger: "order_created",
  minTotal: "",
  locationId: "",
  maxRating: "",
  hoursBefore: "",
  inactiveDays: "",
  actions: [{ type: "whatsapp", message: "" }],
};

export function AutomationManager({
  storeId,
  storeName,
  lang,
  dict,
  initial,
  runs,
  locations,
}: {
  storeId: string;
  storeName: string;
  lang: Locale;
  dict: Dictionary;
  initial: AutomationRow[];
  runs: RunRow[];
  locations: LocationOption[];
}) {
  const router = useRouter();
  const t = dict.os.automations;

  const [editingId, setEditingId] = useState<string | null>(null); // "new" | row id | null
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [pendingRecipe, setPendingRecipe] = useState<string | null>(null);

  const existingNames = useMemo(
    () => new Set(initial.map((a) => (a.name ?? "").trim())),
    [initial],
  );

  const locationName = (id: string | undefined) => {
    if (!id) return t.conditions.anyLocation;
    const l = locations.find((x) => x.id === id);
    return l?.name?.trim() || l?.region || t.conditions.location;
  };

  // ===== Recipes (one-tap presets). Payload text is localized via the dict. =====
  const recipes = useMemo(() => {
    const r = t.recipes;
    const wa = (msg: string) => msg.replace("{store}", storeName);
    return [
      {
        id: "thanks",
        Icon: MessageCircle,
        tint: "bg-success-soft text-success",
        name: r.thanks.name,
        desc: r.thanks.desc,
        trigger: "order_completed" as TriggerKey,
        conditions: {} as Conditions,
        actions: [
          { type: "whatsapp", message: wa(r.thanks.message) },
        ] as Action[],
      },
      {
        id: "abandonedCart",
        Icon: ShoppingCart,
        tint: "bg-danger-soft text-danger",
        name: r.abandonedCart.name,
        desc: r.abandonedCart.desc,
        trigger: "order_abandoned" as TriggerKey,
        conditions: {} as Conditions,
        actions: [
          { type: "whatsapp", message: wa(r.abandonedCart.message) },
        ] as Action[],
      },
      {
        id: "reviewReq",
        Icon: Star,
        tint: "bg-warning-soft text-warning",
        name: r.reviewReq.name,
        desc: r.reviewReq.desc,
        trigger: "order_completed" as TriggerKey,
        conditions: {} as Conditions,
        actions: [
          { type: "whatsapp", message: wa(r.reviewReq.message) },
        ] as Action[],
      },
      {
        id: "lowStock",
        Icon: PackageX,
        tint: "bg-info-soft text-info",
        name: r.lowStock.name,
        desc: r.lowStock.desc,
        trigger: "low_stock" as TriggerKey,
        conditions: {} as Conditions,
        actions: [
          {
            type: "notify",
            title: r.lowStock.notifyTitle,
            body: r.lowStock.notifyBody,
          },
        ] as Action[],
      },
      {
        id: "loyalty",
        Icon: Sparkles,
        tint: "bg-primary-soft text-primary",
        name: r.loyalty.name,
        desc: r.loyalty.desc,
        trigger: "order_completed" as TriggerKey,
        conditions: { min_total: 50 } as Conditions,
        actions: [{ type: "loyalty", points: 10 }] as Action[],
      },
      {
        id: "bigOrder",
        Icon: BadgeDollarSign,
        tint: "bg-primary-soft text-primary",
        name: r.bigOrder.name,
        desc: r.bigOrder.desc,
        trigger: "order_created" as TriggerKey,
        conditions: { min_total: 100 } as Conditions,
        actions: [
          {
            type: "notify",
            title: r.bigOrder.notifyTitle,
            body: r.bigOrder.notifyBody,
          },
        ] as Action[],
      },
      {
        id: "badReview",
        Icon: AlertTriangle,
        tint: "bg-danger-soft text-danger",
        name: r.badReview.name,
        desc: r.badReview.desc,
        trigger: "new_review" as TriggerKey,
        conditions: { max_rating: 2 } as Conditions,
        actions: [
          {
            type: "notify",
            title: r.badReview.notifyTitle,
            body: r.badReview.notifyBody,
          },
        ] as Action[],
      },
      {
        id: "bookingReminder",
        Icon: Clock,
        tint: "bg-info-soft text-info",
        name: r.bookingReminder.name,
        desc: r.bookingReminder.desc,
        trigger: "booking_reminder" as TriggerKey,
        conditions: { hours_before: 1 } as Conditions,
        actions: [
          { type: "whatsapp", message: wa(r.bookingReminder.message) },
        ] as Action[],
      },
      {
        id: "winback",
        Icon: Moon,
        tint: "bg-primary-soft text-primary",
        name: r.winback.name,
        desc: r.winback.desc,
        trigger: "customer_inactive" as TriggerKey,
        conditions: { inactive_days: 30 } as Conditions,
        actions: [{ type: "coupon", percent: 10 }] as Action[],
      },
    ];
  }, [t, storeName]);

  async function enableRecipe(recipe: (typeof recipes)[number]) {
    setPendingRecipe(recipe.id);
    const { error } = await createClient()
      .from("automations")
      .insert({
        store_id: storeId,
        name: recipe.name,
        trigger: recipe.trigger,
        conditions: recipe.conditions,
        actions: recipe.actions,
        enabled: true,
      });
    setPendingRecipe(null);
    if (error) {
      notifyError(dict.common.actionFailed);
      return;
    }
    notifySuccess(t.enabledToast);
    router.refresh();
  }

  // ===== Builder open/edit =====
  function openNew() {
    setDraft(emptyDraft);
    setEditingId("new");
  }
  function openEdit(a: AutomationRow) {
    const c = a.conditions ?? {};
    setDraft({
      name: a.name ?? "",
      trigger: a.trigger,
      minTotal: c.min_total != null ? String(c.min_total) : "",
      locationId: c.location_id ?? "",
      maxRating: c.max_rating != null ? String(c.max_rating) : "",
      hoursBefore: c.hours_before != null ? String(c.hours_before) : "",
      inactiveDays: c.inactive_days != null ? String(c.inactive_days) : "",
      actions: (a.actions ?? []).length
        ? (a.actions as Action[])
        : [defaultAction("notify")],
    });
    setEditingId(a.id);
  }
  function cancel() {
    setEditingId(null);
    setDraft(emptyDraft);
  }

  function setActionField(idx: number, patch: Partial<Action>) {
    setDraft((d) => ({
      ...d,
      actions: d.actions.map((a, i) =>
        i === idx ? ({ ...a, ...patch } as Action) : a,
      ),
    }));
  }
  function addAction(type: ActionType) {
    setDraft((d) => ({ ...d, actions: [...d.actions, defaultAction(type)] }));
  }
  function removeAction(idx: number) {
    setDraft((d) => ({ ...d, actions: d.actions.filter((_, i) => i !== idx) }));
  }

  async function save() {
    if (!draft.actions.length) {
      notifyError(t.noActions);
      return;
    }
    const flags = TRIGGER_CONDS[draft.trigger];
    const conditions: Conditions = {};
    if (flags.minTotal && draft.minTotal.trim())
      conditions.min_total = Number(draft.minTotal);
    if (flags.location && draft.locationId)
      conditions.location_id = draft.locationId;
    if (flags.maxRating && draft.maxRating.trim())
      conditions.max_rating = Number(draft.maxRating);
    if (flags.hoursBefore && draft.hoursBefore.trim())
      conditions.hours_before = Math.max(1, Number(draft.hoursBefore) || 1);
    if (flags.inactiveDays && draft.inactiveDays.trim())
      conditions.inactive_days = Math.max(1, Number(draft.inactiveDays) || 30);

    // Normalise numeric action params.
    const actions: Action[] = draft.actions.map((a) => {
      if (a.type === "loyalty")
        return { type: "loyalty", points: Math.max(0, Number(a.points) || 0) };
      if (a.type === "coupon")
        return {
          type: "coupon",
          percent: Math.min(100, Math.max(0, Number(a.percent) || 0)),
        };
      return a;
    });

    const payload = {
      name: draft.name.trim() || t.triggers[draft.trigger],
      trigger: draft.trigger,
      conditions,
      actions,
    };

    setBusy(true);
    const supabase = createClient();
    const { error } =
      editingId === "new"
        ? await supabase
            .from("automations")
            .insert({ ...payload, store_id: storeId, enabled: true })
        : editingId
          ? await supabase
              .from("automations")
              .update(payload)
              .eq("id", editingId)
          : { error: null };
    setBusy(false);
    if (error) {
      notifyError(dict.common.actionFailed);
      return;
    }
    notifySuccess(editingId === "new" ? t.enabledToast : t.savedToast);
    cancel();
    router.refresh();
  }

  async function toggle(a: AutomationRow) {
    setBusy(true);
    const { error } = await createClient()
      .from("automations")
      .update({ enabled: !a.enabled })
      .eq("id", a.id);
    setBusy(false);
    if (error) {
      notifyError(dict.common.actionFailed);
      return;
    }
    router.refresh();
  }

  async function remove(a: AutomationRow) {
    if (!window.confirm(t.confirmDelete)) return;
    setBusy(true);
    const { error } = await createClient()
      .from("automations")
      .delete()
      .eq("id", a.id);
    setBusy(false);
    if (error) {
      notifyError(dict.common.actionFailed);
      return;
    }
    router.refresh();
  }

  // ===== Human-readable summary for a saved automation =====
  function conditionChips(c: Conditions | null): string[] {
    if (!c) return [];
    const out: string[] = [];
    if (c.min_total != null) out.push(`${t.condMinTotal} $${c.min_total}`);
    if (c.location_id) out.push(`${t.condLocation}: ${locationName(c.location_id)}`);
    if (c.max_rating != null) out.push(`${t.condMaxRating} ${c.max_rating}★`);
    if (c.hours_before != null)
      out.push(`${t.condHoursBefore} ${c.hours_before} ${t.hoursUnit}`);
    if (c.inactive_days != null)
      out.push(`${t.condInactiveDays} ${c.inactive_days} ${t.daysUnit}`);
    return out;
  }
  function actionLabel(a: Action): string {
    if (a.type === "loyalty")
      return `${t.actions.loyalty} +${a.points} ${t.pointsUnit}`;
    if (a.type === "coupon")
      return `${t.actions.coupon} ${a.percent}${t.percentOff}`;
    return t.actions[a.type];
  }

  const flags = TRIGGER_CONDS[draft.trigger];
  const showLocation = !!flags.location && locations.length > 0;
  const hasAnyCond =
    !!flags.minTotal ||
    showLocation ||
    !!flags.maxRating ||
    !!flags.hoursBefore ||
    !!flags.inactiveDays;

  // ===== Builder form (shared by new + edit) =====
  const form = (
    <div className="rounded-3xl border border-primary/30 bg-surface p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center gap-2 text-sm font-bold text-primary">
        <Wand2 className="h-4 w-4" />
        {editingId === "new" ? t.customTitle : t.edit}
      </div>

      <label className="block text-sm font-semibold">
        {t.nameLabel}
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder={t.nameHint}
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </label>

      {/* Vertical When → If → Do flow */}
      <div className="mt-5">
        {/* WHEN */}
        <FlowStep
          Icon={Zap}
          nodeClass="bg-gradient-to-br from-primary to-sky-500 text-white"
          label={t.whenLabel}
          hint={t.whenHint}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TRIGGERS.map((tr) => {
              const TrIcon = TRIGGER_ICON[tr];
              const active = draft.trigger === tr;
              return (
                <button
                  key={tr}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      trigger: tr,
                      // reset conditions that no longer apply
                      minTotal: TRIGGER_CONDS[tr].minTotal ? d.minTotal : "",
                      locationId: TRIGGER_CONDS[tr].location ? d.locationId : "",
                      maxRating: TRIGGER_CONDS[tr].maxRating ? d.maxRating : "",
                      hoursBefore: TRIGGER_CONDS[tr].hoursBefore
                        ? d.hoursBefore
                        : "",
                      inactiveDays: TRIGGER_CONDS[tr].inactiveDays
                        ? d.inactiveDays
                        : "",
                    }))
                  }
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-start text-sm font-semibold transition-all ${
                    active
                      ? "border-primary bg-primary-soft text-primary shadow-sm"
                      : "border-border bg-surface text-foreground hover:border-primary/40"
                  }`}
                >
                  <TrIcon
                    className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span className="truncate">{t.triggers[tr]}</span>
                </button>
              );
            })}
          </div>
        </FlowStep>

        {/* IF */}
        <FlowStep
          Icon={Filter}
          nodeClass="bg-warning-soft text-warning"
          label={t.ifLabel}
          hint={t.ifHint}
        >
          {hasAnyCond ? (
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
                    onChange={(e) =>
                      setDraft({ ...draft, minTotal: e.target.value })
                    }
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
                    onChange={(e) =>
                      setDraft({ ...draft, locationId: e.target.value })
                    }
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
                    onChange={(e) =>
                      setDraft({ ...draft, maxRating: e.target.value })
                    }
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
                    onChange={(e) =>
                      setDraft({ ...draft, hoursBefore: e.target.value })
                    }
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
                    onChange={(e) =>
                      setDraft({ ...draft, inactiveDays: e.target.value })
                    }
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
          )}
        </FlowStep>

        {/* DO */}
        <FlowStep
          Icon={Play}
          nodeClass="bg-success-soft text-success"
          label={t.doLabel}
          hint={t.doHint}
          last
        >
          <div className="space-y-3">
            {draft.actions.map((a, idx) => {
              const AIcon = ACTION_ICON[a.type];
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-border bg-surface-muted/40 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg ${ACTION_TINT[a.type]}`}
                    >
                      <AIcon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-sm font-bold">
                      {t.actions[a.type]}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAction(idx)}
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
                          onChange={(e) =>
                            setActionField(idx, { title: e.target.value })
                          }
                          placeholder={t.params.notifyTitle}
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                        <textarea
                          value={a.body}
                          onChange={(e) =>
                            setActionField(idx, { body: e.target.value })
                          }
                          placeholder={t.params.notifyBody}
                          rows={2}
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </div>
                    )}
                    {a.type === "whatsapp" && (
                      <textarea
                        value={a.message}
                        onChange={(e) =>
                          setActionField(idx, { message: e.target.value })
                        }
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
                            setActionField(idx, {
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
                            setActionField(idx, {
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
            })}

            {/* Add-action chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {ACTION_TYPES.map((type) => {
                const AIcon = ACTION_ICON[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addAction(type)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <AIcon className="h-3.5 w-3.5" />
                    {t.actions[type]}
                  </button>
                );
              })}
            </div>
          </div>
        </FlowStep>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          <Check className="h-4 w-4" />
          {t.save}
        </button>
        <button
          type="button"
          onClick={cancel}
          className="rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );

  return (
    <div className="mt-8 space-y-10">
      {/* ===== Recipe gallery ===== */}
      <section>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-extrabold tracking-tight">
            {t.recipesTitle}
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.recipesSubtitle}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {recipes.map((r) => {
            const added = existingNames.has(r.name.trim());
            const pending = pendingRecipe === r.id;
            return (
              <div
                key={r.id}
                className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${r.tint}`}
                  >
                    <r.Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold leading-tight">{r.name}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {r.desc}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={added || pending}
                  onClick={() => enableRecipe(r)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                    added
                      ? "cursor-default bg-success-soft text-success"
                      : "bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
                  }`}
                >
                  {added ? (
                    <>
                      <Check className="h-4 w-4" />
                      {t.added}
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      {t.enable}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== Custom builder ===== */}
      <section>
        {editingId === "new" ? (
          form
        ) : (
          <button
            type="button"
            onClick={openNew}
            className="flex w-full items-center gap-4 rounded-3xl border border-dashed border-primary/40 bg-gradient-to-br from-primary/5 to-transparent p-5 text-start transition-colors hover:border-primary"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Wand2 className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold">{t.customTitle}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {t.customSubtitle}
              </span>
            </span>
            <span className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
              <Plus className="h-4 w-4" />
              {t.newButton}
            </span>
          </button>
        )}
      </section>

      {/* ===== Existing automations ===== */}
      <section>
        <h2 className="text-lg font-extrabold tracking-tight">{t.listTitle}</h2>
        <div className="mt-4 space-y-3">
          {initial.length === 0 && editingId !== "new" && (
            <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              {t.listEmpty}
            </div>
          )}
          {initial.map((a) =>
            editingId === a.id ? (
              <div key={a.id}>{form}</div>
            ) : (
              <div
                key={a.id}
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
                        {(() => {
                          const TrIcon = TRIGGER_ICON[a.trigger];
                          return <TrIcon className="h-3 w-3" />;
                        })()}
                        {t.triggers[a.trigger]}
                      </span>
                      {conditionChips(a.conditions).map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 font-semibold text-warning"
                        >
                          <Filter className="h-3 w-3" />
                          {c}
                        </span>
                      ))}
                      <ChevronRight className="h-3 w-3 text-muted-foreground rtl:rotate-180" />
                      {(a.actions ?? []).map((ac, i) => (
                        <span
                          key={i}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${ACTION_TINT[ac.type]}`}
                        >
                          {(() => {
                            const AIcon = ACTION_ICON[ac.type];
                            return <AIcon className="h-3 w-3" />;
                          })()}
                          {actionLabel(ac)}
                        </span>
                      ))}
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
                      onClick={() => toggle(a)}
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
                    onClick={() => openEdit(a)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                    {t.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(a)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t.delete}
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      {/* ===== Activity feed ===== */}
      <section>
        <h2 className="text-lg font-extrabold tracking-tight">
          {t.activityTitle}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.activitySubtitle}
        </p>
        <div className="mt-4">
          {runs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              {t.activityEmpty}
            </div>
          ) : (
            <ul className="space-y-2">
              {runs.map((run) => {
                const auto = initial.find((a) => a.id === run.automation_id);
                const name =
                  auto?.name?.trim() ||
                  (auto ? t.triggers[auto.trigger] : t.unknownAutomation);
                return (
                  <li
                    key={run.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
                  >
                    <StatusPill status={run.status} dict={dict} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.triggers[run.trigger as TriggerKey] ?? run.trigger}
                      </p>
                    </div>
                    <time
                      className="shrink-0 text-xs text-muted-foreground"
                      dateTime={run.created_at}
                    >
                      {timeAgo(run.created_at, lang)}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

// Vertical flow step: a colored node on a connective rail + its content.
function FlowStep({
  Icon,
  nodeClass,
  label,
  hint,
  last,
  children,
}: {
  Icon: LucideIcon;
  nodeClass: string;
  label: string;
  hint: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex gap-3 sm:gap-4">
      <div className="flex flex-col items-center">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ${nodeClass}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2.5} />
        </span>
        {!last && <span className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className={`min-w-0 flex-1 ${last ? "pb-1" : "pb-6"}`}>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-extrabold">{label}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
        <div className="mt-2.5">{children}</div>
      </div>
    </div>
  );
}

function StatusPill({
  status,
  dict,
}: {
  status: RunRow["status"];
  dict: Dictionary;
}) {
  const t = dict.os.automations.status;
  const map: Record<RunRow["status"], { cls: string; label: string }> = {
    fired: { cls: "bg-success-soft text-success", label: t.fired },
    skipped: { cls: "bg-surface-muted text-muted-foreground", label: t.skipped },
    error: { cls: "bg-danger-soft text-danger", label: t.error },
  };
  const s = map[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${s.cls}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "fired"
            ? "bg-emerald-500"
            : status === "error"
              ? "bg-red-500"
              : "bg-muted-foreground/50"
        }`}
      />
      {s.label}
    </span>
  );
}
