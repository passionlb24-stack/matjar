"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Ban, Play, Users } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";

export type AdminUser = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "customer" | "merchant" | "super_admin" | "driver";
  is_active: boolean;
  created_at: string;
};

const roleVariant: Record<
  AdminUser["role"],
  "neutral" | "primary" | "info" | "warning"
> = {
  super_admin: "primary",
  merchant: "info",
  customer: "neutral",
  driver: "warning",
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

  const initial = (name: string | null) =>
    (name ?? "").trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="py-10">
      <Container>
        <PageHeader icon={Users} title={t.title} subtitle={t.subtitle} />

        <div className="relative mb-6 sm:max-w-md">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            className="ps-10"
          />
        </div>

        {filtered.length ? (
          <Card>
            <div data-animate className="divide-y divide-border">
              {filtered.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <div
                    key={u.id}
                    className="flex flex-col gap-3 p-4 transition-colors hover:bg-surface-muted sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-extrabold text-primary">
                        {initial(u.full_name)}
                      </span>
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
                          <Badge variant={roleVariant[u.role]} size="sm">
                            {t.roles[u.role]}
                          </Badge>
                          {!u.is_active && (
                            <Badge variant="danger" size="sm">
                              {t.suspended}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {u.phone ? `${u.phone} · ` : ""}
                          {t.joined} {fmtDate(u.created_at)}
                        </p>
                      </div>
                    </div>

                    {!isSelf && u.role !== "super_admin" && (
                      <Button
                        size="sm"
                        variant={u.is_active ? "secondary" : "primary"}
                        disabled={busy === u.id}
                        onClick={() => toggle(u.id, !u.is_active)}
                        leftIcon={
                          u.is_active ? (
                            <Ban className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )
                        }
                        className={u.is_active ? "shrink-0 !text-danger" : "shrink-0"}
                      >
                        {u.is_active ? t.suspend : t.reactivate}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          <EmptyState icon={Users} title={t.empty} />
        )}
      </Container>
    </div>
  );
}
