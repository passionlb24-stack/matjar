"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Ticket } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { fieldClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export type TicketTypeRow = {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  price: number;
  capacity: number | null;
  sold: number;
  active: boolean;
};

const field = `${fieldClass} mt-1`;

// Merchant ticket-type management for events (0193). Add / list / delete ticket
// types; RLS (ticket_types_manage) scopes writes to the store's managers. `sold`
// is read-only (driven by buy_tickets); a type with sales cannot be edited away.
export function TicketTypeManager({
  storeId,
  dict,
  initial,
}: {
  storeId: string;
  dict: Dictionary;
  initial: TicketTypeRow[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const t = dict.os.tickets;
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    const capRaw = String(form.get("capacity") ?? "").trim();
    setBusy(true);
    const { error } = await createClient()
      .from("event_ticket_types")
      .insert({
        store_id: storeId,
        name,
        name_en: String(form.get("name_en") ?? "").trim() || null,
        description: String(form.get("description") ?? "").trim() || null,
        price: Number(form.get("price")) || 0,
        capacity: capRaw === "" ? null : Math.max(0, Number(capRaw)),
      });
    setBusy(false);
    if (error) {
      notifyError(dict.auth.errorGeneric);
      return;
    }
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  async function remove(id: string) {
    if (
      !(await confirm({
        message: t.confirmDelete,
        confirmLabel: dict.common.confirm,
        cancelLabel: dict.common.cancel,
        danger: true,
      }))
    )
      return;
    const { error } = await createClient()
      .from("event_ticket_types")
      .delete()
      .eq("id", id);
    if (error) {
      notifyError(dict.common.actionFailed);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        {initial.length ? (
          <div className="space-y-3">
            {initial.map((tt) => {
              const left = tt.capacity == null ? null : tt.capacity - tt.sold;
              return (
                <div
                  key={tt.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
                    <Ticket className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{tt.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ${tt.price} · {tt.sold} {t.soldCount}
                      {left != null ? ` · ${left} ${t.remaining}` : ` · ${t.unlimited}`}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(tt.id)}
                    aria-label={t.delete}
                    className="flex w-10 shrink-0 items-center justify-center self-stretch rounded-lg border border-border text-danger transition-colors hover:bg-danger-soft"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
            {t.empty}
          </div>
        )}
      </div>

      <form
        onSubmit={add}
        className="space-y-3 rounded-2xl border border-border bg-surface p-5"
      >
        <h3 className="font-bold">{t.add}</h3>
        <div>
          <label className="text-sm font-semibold">
            {t.name}
            <input name="name" required className={field} />
          </label>
        </div>
        <div>
          <label className="text-sm font-semibold">
            {t.nameEn}
            <input name="name_en" className={field} />
          </label>
        </div>
        <div>
          <label className="text-sm font-semibold">
            {t.description}
            <input name="description" className={field} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-semibold">
            {t.price}
            <input name="price" type="number" min="0" step="0.01" className={field} />
          </label>
          <label className="text-sm font-semibold">
            {t.capacity}
            <input
              name="capacity"
              type="number"
              min="0"
              placeholder={t.unlimited}
              className={field}
            />
          </label>
        </div>
        <Button type="submit" full loading={busy} leftIcon={<Plus className="h-4 w-4" />}>
          {t.save}
        </Button>
      </form>
    </div>
  );
}
