"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Trash2,
  MessageCircle,
  BookUser,
  ClipboardList,
  Gift,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { Dictionary } from "@/i18n/get-dictionary";

export type BookCustomer = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  status: "new" | "regular" | "vip" | "inactive";
  follow_up_on: string | null;
};

export type DerivedCustomer = {
  name: string | null;
  phone: string | null;
  count: number;
  total: number;
  // profiles.id when the order was placed by a registered account (loyalty
  // points are keyed by user, so only these customers can have a balance).
  customerId: string | null;
};

const statusStyle: Record<BookCustomer["status"], string> = {
  new: "bg-sky-100 text-sky-700",
  regular: "bg-primary-soft text-primary",
  vip: "bg-amber-100 text-amber-700",
  inactive: "bg-zinc-100 text-zinc-500",
};

function waHref(phone: string) {
  return `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;
}

function formatPrice(price: number) {
  return price >= 1000
    ? `$${Number(price).toLocaleString("en-US")}`
    : `$${price}`;
}

// CRM module of the Business OS: the merchant's own customer book (walk-ins,
// phone customers) side by side with customers derived from platform orders.
export function CrmManager({
  storeId,
  dict,
  book,
  derived,
  balances = {},
}: {
  storeId: string;
  dict: Dictionary;
  book: BookCustomer[];
  derived: DerivedCustomer[];
  // customerId (profiles.id) → available loyalty points. Only registered
  // customers appear; everyone else defaults to 0.
  balances?: Record<string, number>;
}) {
  const router = useRouter();
  const t = dict.os.crm;
  const [tab, setTab] = useState<"book" | "orders">("book");
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const bookPhones = new Set(book.map((c) => c.phone).filter(Boolean));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await createClient().from("store_customers").insert({
      store_id: storeId,
      name: name.trim(),
      phone: phone.trim() || null,
    });
    setBusy(false);
    if (error) {
      window.alert(dict.auth.errorGeneric);
      return;
    }
    setName("");
    setPhone("");
    router.refresh();
  }

  async function quickAdd(c: DerivedCustomer) {
    setBusy(true);
    const { error } = await createClient().from("store_customers").insert({
      store_id: storeId,
      name: c.name ?? c.phone ?? "—",
      phone: c.phone,
      status: "regular",
    });
    setBusy(false);
    if (error) {
      window.alert(dict.auth.errorGeneric);
      return;
    }
    router.refresh();
  }

  async function setStatus(id: string, status: BookCustomer["status"]) {
    const { error } = await createClient()
      .from("store_customers")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      window.alert(dict.auth.errorGeneric);
      return;
    }
    router.refresh();
  }

  async function saveNotes(id: string, notes: string) {
    const { error } = await createClient()
      .from("store_customers")
      .update({ notes: notes.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) window.alert(dict.auth.errorGeneric);
  }

  async function setFollowUp(id: string, date: string) {
    const { error } = await createClient()
      .from("store_customers")
      .update({
        follow_up_on: date || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      window.alert(dict.auth.errorGeneric);
      return;
    }
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm(t.confirmDelete)) return;
    const { error } = await createClient()
      .from("store_customers")
      .delete()
      .eq("id", id);
    if (error) {
      window.alert(dict.auth.errorGeneric);
      return;
    }
    router.refresh();
  }

  const q = query.trim().toLowerCase();
  const filteredBook = book.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q),
  );
  const filteredDerived = derived.filter(
    (c) =>
      !q ||
      (c.name ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q),
  );

  const tabBtn = (active: boolean) =>
    `flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border text-muted-foreground hover:border-primary/40"
    }`;

  const today = new Date().toISOString().slice(0, 10);
  const dueFollowUps = book
    .filter((c) => c.follow_up_on != null && c.follow_up_on <= today)
    .sort((a, b) => (a.follow_up_on! < b.follow_up_on! ? -1 : 1));

  return (
    <div>
      {/* Follow-ups due (clinic deep pack — works for every sector). */}
      {dueFollowUps.length > 0 && (
        <section className="mb-4 rounded-2xl border border-primary/30 bg-primary-soft/40 p-4">
          <h2 className="font-bold text-primary">{t.followUpsTitle}</h2>
          <div className="mt-3 space-y-2">
            {dueFollowUps.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{c.name}</span>
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    {c.follow_up_on}
                  </span>
                </span>
                {c.phone && (
                  <a
                    href={waHref(c.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setFollowUp(c.id, "")}
                  className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-bold transition-colors hover:border-primary hover:text-primary"
                >
                  {t.followUpDone}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setTab("book")} className={tabBtn(tab === "book")}>
          <BookUser className="h-4 w-4" />
          {t.book} ({book.length})
        </button>
        <button type="button" onClick={() => setTab("orders")} className={tabBtn(tab === "orders")}>
          <ClipboardList className="h-4 w-4" />
          {t.fromOrders} ({derived.length})
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-surface px-4 sm:max-w-sm">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search}
          className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {tab === "book" ? (
        <>
          <form
            onSubmit={add}
            className="mt-4 flex flex-wrap items-stretch gap-2 rounded-2xl border border-border bg-surface p-3"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.name}
              className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary sm:w-auto sm:flex-1"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.phone}
              dir="ltr"
              className="w-40 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {t.add}
            </button>
          </form>

          {filteredBook.length ? (
            <div className="mt-4 space-y-2">
              {filteredBook.map((c) => (
                <details
                  key={c.id}
                  className="group rounded-2xl border border-border bg-surface"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">
                      {c.name.trim().charAt(0) || "؟"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{c.name}</span>
                      {c.phone && (
                        <span dir="ltr" className="block text-sm text-muted-foreground">
                          {c.phone}
                        </span>
                      )}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${statusStyle[c.status]}`}
                    >
                      {t.status[c.status]}
                    </span>
                    {c.phone && (
                      <a
                        href={waHref(c.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="WhatsApp"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                  </summary>
                  <div className="border-t border-border p-4">
                    <div className="flex flex-wrap gap-1.5">
                      {(["new", "regular", "vip", "inactive"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(c.id, s)}
                          className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                            c.status === s
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          {t.status[s]}
                        </button>
                      ))}
                    </div>
                    <label className="mt-3 block text-sm">
                      <span className="font-semibold text-muted-foreground">
                        {t.followUp}
                      </span>
                      <input
                        type="date"
                        defaultValue={c.follow_up_on ?? ""}
                        onChange={(e) => setFollowUp(c.id, e.target.value)}
                        className="mt-1 block rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </label>
                    <textarea
                      defaultValue={c.notes ?? ""}
                      onBlur={(e) => saveNotes(c.id, e.target.value)}
                      placeholder={t.notes}
                      rows={2}
                      className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {dict.merchant.products.delete}
                    </button>
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
              {t.empty}
            </div>
          )}
        </>
      ) : filteredDerived.length ? (
        <div className="mt-4 space-y-2">
          {filteredDerived.map((c, i) => {
            const points = c.customerId ? (balances[c.customerId] ?? 0) : 0;
            return (
              <div
                key={i}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">
                      {c.name ?? c.phone ?? "—"}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {c.phone ? <span dir="ltr">{c.phone}</span> : null}
                      {c.phone ? " · " : ""}
                      {c.count} {dict.merchant.ordersCount}
                    </span>
                  </span>
                  {points > 0 && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-bold text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      {points.toLocaleString("en-US")} {t.points}
                    </span>
                  )}
                  <span className="shrink-0 font-bold text-primary">
                    {formatPrice(c.total)}
                  </span>
                  {c.phone && !bookPhones.has(c.phone) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => quickAdd(c)}
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-bold transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t.addToBook}
                    </button>
                  )}
                </div>
                {c.customerId && points > 0 && (
                  <RedeemControl
                    storeId={storeId}
                    customerId={c.customerId}
                    balance={points}
                    dict={dict}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
          {t.emptyDerived}
        </div>
      )}
    </div>
  );
}

// Redeem a registered customer's loyalty points (e.g. as an in-store discount).
// Points are a single global per-user balance; the server RPC re-checks that the
// caller manages the store, recomputes the balance, and caps the redemption.
function RedeemControl({
  storeId,
  customerId,
  balance,
  dict,
}: {
  storeId: string;
  customerId: string;
  balance: number;
  dict: Dictionary;
}) {
  const router = useRouter();
  const t = dict.os.crm;
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const p = Math.floor(Number(points));
    if (!p || p <= 0 || busy) return;
    if (p > balance) {
      notifyError(t.insufficientPoints);
      return;
    }
    setBusy(true);
    const { error } = await createClient().rpc("redeem_loyalty_points", {
      p_store_id: storeId,
      p_customer_id: customerId,
      p_points: p,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      const m = error.message ?? "";
      notifyError(
        m.includes("insufficient_points")
          ? t.insufficientPoints
          : dict.common.actionFailed,
      );
      return;
    }
    notifySuccess(t.redeemSuccess);
    setPoints("");
    setNote("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold transition-colors hover:border-primary hover:text-primary"
      >
        <Gift className="h-3.5 w-3.5" />
        {t.redeem}
      </button>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface-muted/50 p-3">
      <label className="text-xs font-semibold">
        <span className="mb-1 block text-muted-foreground">{t.redeemAmount}</span>
        <input
          type="number"
          min="1"
          max={balance}
          step="1"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          className="w-28 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </label>
      <label className="min-w-0 flex-1 text-xs font-semibold">
        <span className="mb-1 block text-muted-foreground">{t.redeemNote}</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.redeemNoteHint}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </label>
      <button
        type="button"
        onClick={submit}
        disabled={busy || !points}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {t.redeemConfirm}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        {t.cancel}
      </button>
    </div>
  );
}
