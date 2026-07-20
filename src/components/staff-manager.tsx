"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/get-dictionary";

type Perms = { orders: boolean; products: boolean; bookings: boolean };
type Staff = {
  id: string;
  email: string | null;
  role: string;
  permissions: Record<string, boolean> | null;
};

const PERM_KEYS = ["orders", "products", "bookings"] as const;

function normalize(p: Record<string, boolean> | null): Perms {
  // Default missing keys to false so the toggle matches enforcement, which
  // coalesces a missing permission to false (staff_can, items/pos pages).
  return {
    orders: p?.orders ?? false,
    products: p?.products ?? false,
    bookings: p?.bookings ?? false,
  };
}

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
  const [perms, setPerms] = useState<Record<string, Perms>>(
    Object.fromEntries(staff.map((s) => [s.id, normalize(s.permissions)])),
  );

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

  async function togglePerm(staffId: string, key: keyof Perms) {
    const current = perms[staffId] ?? normalize(null);
    const next = { ...current, [key]: !current[key] };
    setPerms((p) => ({ ...p, [staffId]: next }));
    const { error } = await createClient()
      .from("store_staff")
      .update({ permissions: next })
      .eq("id", staffId);
    if (error) {
      // Revert the optimistic flip — a "revoked" permission must never look
      // revoked while still active in the database.
      setPerms((p) => ({ ...p, [staffId]: current }));
      window.alert(dict.auth.errorGeneric);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(dict.merchant.products.confirmDelete)) return;
    setBusy(true);
    const { error } = await createClient()
      .from("store_staff")
      .delete()
      .eq("id", id);
    setBusy(false);
    if (error) {
      window.alert(dict.auth.errorGeneric);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={onAdd} className="flex gap-2">
        <Input
          name="email"
          type="email"
          required
          placeholder={dict.merchant.staffEmail}
          className="flex-1 min-w-0"
        />
        <Button type="submit" loading={busy}>
          {dict.merchant.staffAdd}
        </Button>
      </form>
      {msg && (
        <p className="mt-2 text-sm font-medium text-muted-foreground">{msg}</p>
      )}

      <div className="mt-5 space-y-3">
        {staff.length ? (
          staff.map((s) => {
            const sp = perms[s.id] ?? normalize(s.permissions);
            return (
              <div
                key={s.id}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{s.email}</span>
                  <button
                    onClick={() => remove(s.id)}
                    disabled={busy}
                    aria-label="remove"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    {dict.merchant.perms.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PERM_KEYS.map((key) => (
                      <label
                        key={key}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                          sp[key]
                            ? "border-primary bg-primary-soft text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={sp[key]}
                          onChange={() => togglePerm(s.id, key)}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        {dict.merchant.perms[key]}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">{dict.merchant.noStaff}</p>
        )}
      </div>
    </div>
  );
}
