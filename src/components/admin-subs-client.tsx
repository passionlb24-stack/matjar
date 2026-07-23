"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Crown, RotateCcw, CreditCard } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { logAdminAction } from "@/lib/audit";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";

export type SubRow = {
  id: string;
  name: string;
  plan: "free" | "pro";
  subId: string | null;
  expiresAt: string | null;
  payments: number;
};

function Row({
  row,
  lang,
  dict,
}: {
  row: SubRow;
  lang: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const t = dict.admin.subs;
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [amount, setAmount] = useState("12");
  const [busy, setBusy] = useState(false);

  // Read the clock once for the expiry badge; harmless in render for a status display.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const expiresMs = row.expiresAt ? new Date(row.expiresAt).getTime() : null;
  const isPro = row.plan === "pro";
  const expired = expiresMs != null && expiresMs <= now;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "ar" ? "ar" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  function changePeriod(p: "monthly" | "yearly") {
    setPeriod(p);
    setAmount(p === "yearly" ? "120" : "12");
  }

  async function activate() {
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const base =
      expiresMs && expiresMs > now ? new Date(expiresMs) : new Date();
    const expires = new Date(base);
    if (period === "yearly") expires.setFullYear(expires.getFullYear() + 1);
    else expires.setMonth(expires.getMonth() + 1);

    let subId = row.subId;
    if (subId) {
      await supabase
        .from("subscriptions")
        .update({
          status: "active",
          plan: "pro",
          expires_at: expires.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", subId);
    } else {
      const { data: created } = await supabase
        .from("subscriptions")
        .insert({
          store_id: row.id,
          plan: "pro",
          status: "active",
          expires_at: expires.toISOString(),
        })
        .select("id")
        .single();
      subId = (created as { id: string } | null)?.id ?? null;
    }
    await supabase.from("payments").insert({
      store_id: row.id,
      subscription_id: subId,
      amount: Number(amount) || 0,
      period,
      method: "manual",
      recorded_by: user?.id ?? null,
    });
    const { error } = await supabase
      .from("stores")
      .update({ plan: "pro", is_verified: true })
      .eq("id", row.id);
    setBusy(false);
    if (error) {
      window.alert(dict.auth.errorGeneric);
      return;
    }
    void logAdminAction("activated", "subscription", row.id, { period });
    router.refresh();
  }

  async function downgrade() {
    if (!window.confirm(dict.admin.confirmDowngrade)) return;
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("store_id", row.id)
      .eq("status", "active");
    const { error } = await supabase
      .from("stores")
      .update({ plan: "free" })
      .eq("id", row.id);
    setBusy(false);
    if (error) {
      window.alert(dict.auth.errorGeneric);
      return;
    }
    void logAdminAction("downgraded", "subscription", row.id);
    router.refresh();
  }

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">{row.name}</h3>
            <Badge variant={isPro ? "warning" : "neutral"} size="sm">
              {isPro && <Crown className="h-3 w-3" />}
              {isPro ? t.pro : t.free}
            </Badge>
            {isPro && row.expiresAt && (
              <Badge variant={expired ? "danger" : "success"} size="sm">
                {expired ? t.expired : t.active} · {t.expires}{" "}
                {fmt(row.expiresAt)}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {row.payments} {t.payments}
            </span>
          </div>
          {isPro && (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={downgrade}
              leftIcon={<RotateCcw className="h-4 w-4" />}
            >
              {t.downgrade}
            </Button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <Field label={t.period} className="w-40">
            <Select
              value={period}
              onChange={(e) =>
                changePeriod(e.target.value as "monthly" | "yearly")
              }
            >
              <option value="monthly">{t.monthly}</option>
              <option value="yearly">{t.yearly}</option>
            </Select>
          </Field>
          <Field label={t.amount} className="w-32">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Button
            disabled={busy}
            loading={busy}
            onClick={activate}
            leftIcon={<Crown className="h-4 w-4" />}
          >
            {busy ? t.saving : t.activate}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export function AdminSubsClient({
  lang,
  dict,
  rows,
}: {
  lang: Locale;
  dict: Dictionary;
  rows: SubRow[];
}) {
  const t = dict.admin.subs;
  const [query, setQuery] = useState("");
  const filtered = rows.filter(
    (r) => !query.trim() || r.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="py-10">
      <Container>
        <PageHeader icon={CreditCard} title={t.title} subtitle={t.subtitle} />

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
          <div data-animate className="space-y-3">
            {filtered.map((r) => (
              <Row key={r.id} row={r} lang={lang} dict={dict} />
            ))}
          </div>
        ) : (
          <EmptyState icon={CreditCard} title={t.empty} />
        )}
      </Container>
    </div>
  );
}
