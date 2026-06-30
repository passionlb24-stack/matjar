"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/get-dictionary";

type Staff = { id: string; email: string | null; role: string };

export function StaffManager({
  storeId,
  dict,
  staff,
}: {
  storeId: string;
  dict: Dictionary;
  staff: Staff[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setBusy(true);
    setMsg(null);
    const email = String(new FormData(formEl).get("email"));
    const supabase = createClient();
    const { data, error } = await supabase.rpc("add_store_staff", {
      p_store_id: storeId,
      p_email: email,
      p_role: "staff",
    });
    setBusy(false);
    if (error || data === "not_owner") {
      setMsg(dict.auth.errorGeneric);
      return;
    }
    if (data === "not_found") {
      setMsg(dict.merchant.staffNotFound);
      return;
    }
    if (data === "self") {
      setMsg(dict.merchant.staffSelf);
      return;
    }
    formEl.reset();
    setMsg(dict.merchant.staffAdded);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    await createClient().from("store_staff").delete().eq("id", id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={onAdd} className="flex gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder={dict.merchant.staffEmail}
          className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
        <button
          disabled={busy}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {dict.merchant.staffAdd}
        </button>
      </form>
      {msg && (
        <p className="mt-2 text-sm font-medium text-muted-foreground">{msg}</p>
      )}

      <div className="mt-5 space-y-2">
        {staff.length ? (
          staff.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-3"
            >
              <span className="text-sm font-semibold">{s.email}</span>
              <button
                onClick={() => remove(s.id)}
                disabled={busy}
                aria-label="remove"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{dict.merchant.noStaff}</p>
        )}
      </div>
    </div>
  );
}
