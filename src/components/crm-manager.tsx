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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/get-dictionary";

export type BookCustomer = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  status: "new" | "regular" | "vip" | "inactive";
};

export type DerivedCustomer = {
  name: string | null;
  phone: string | null;
  count: number;
  total: number;
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
}: {
  storeId: string;
  dict: Dictionary;
  book: BookCustomer[];
  derived: DerivedCustomer[];
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

  return (
    <div>
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
          {filteredDerived.map((c, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">
                  {c.name ?? c.phone ?? "—"}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {c.phone ? (
                    <span dir="ltr">{c.phone}</span>
                  ) : null}
                  {c.phone ? " · " : ""}
                  {c.count} {dict.merchant.ordersCount}
                </span>
              </span>
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
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
          {t.emptyDerived}
        </div>
      )}
    </div>
  );
}
