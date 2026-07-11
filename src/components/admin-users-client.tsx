"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Ban, Play } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { Container } from "@/components/ui/container";

export type AdminUser = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "customer" | "merchant" | "super_admin" | "driver";
  is_active: boolean;
  created_at: string;
};

const roleStyle: Record<AdminUser["role"], string> = {
  super_admin: "bg-primary-soft text-primary",
  merchant: "bg-sky-100 text-sky-700",
  customer: "bg-zinc-100 text-zinc-600",
  driver: "bg-violet-100 text-violet-700",
};

export function AdminUsersClient({
  lang,
  dict,
  users,
  currentUserId,
}: {
  lang: Locale;
  dict: Dictionary;
  users: AdminUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const t = dict.admin.usersAdmin;
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function toggle(id: string, next: boolean) {
    if (!next && !window.confirm(dict.admin.confirmSuspendUser)) return;
    setBusy(id);
    const { error } = await createClient()
      .from("profiles")
      .update({ is_active: next })
      .eq("id", id);
    setBusy(null);
    if (error) {
      window.alert(dict.auth.errorGeneric);
      return;
    }
    router.refresh();
  }

  const filtered = users.filter((u) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      (u.full_name ?? "").toLowerCase().includes(q) ||
      (u.phone ?? "").toLowerCase().includes(q)
    );
  });

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "ar" ? "ar" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="py-10">
      <Container>
        <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>

        <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-surface px-4 sm:max-w-md">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {filtered.length ? (
          <div className="mt-6 space-y-2">
            {filtered.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <div
                  key={u.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">
                        {u.full_name ?? "—"}
                        {isSelf && (
                          <span className="ms-1 text-xs font-normal text-muted-foreground">
                            ({t.you})
                          </span>
                        )}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${roleStyle[u.role]}`}
                      >
                        {t.roles[u.role]}
                      </span>
                      {!u.is_active && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                          {t.suspended}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {u.phone ? `${u.phone} · ` : ""}
                      {t.joined} {fmtDate(u.created_at)}
                    </p>
                  </div>

                  {!isSelf && u.role !== "super_admin" && (
                    <button
                      disabled={busy === u.id}
                      onClick={() => toggle(u.id, !u.is_active)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-60 ${
                        u.is_active
                          ? "border border-border text-red-600 hover:bg-red-50"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      {u.is_active ? (
                        <>
                          <Ban className="h-4 w-4" />
                          {t.suspend}
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          {t.reactivate}
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
            {t.empty}
          </div>
        )}
      </Container>
    </div>
  );
}
