"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  LogIn,
  LogOut,
  KeyRound,
  Wallet,
  Calculator,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";

export type Employee = {
  id: string;
  name: string;
  phone: string | null;
  job_title: string | null;
  pay_basis: "monthly" | "daily" | "hourly";
  pay_rate: number;
  pay_currency: "USD" | "LBP";
  residency_expires_on: string | null;
  status: string;
  has_pin: boolean;
  on_shift: boolean;
};

export type PayrollLine = {
  employee_name: string;
  pay_basis: string;
  currency: string;
  days_worked: number;
  minutes_worked: number;
  gross: number;
  advances: number;
  net: number;
};

export type PayrollRun = {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  total_usd: number;
  total_lbp: number;
  lines: PayrollLine[];
};

type L = Record<string, string>;

function money(n: number, c: string) {
  return c === "LBP"
    ? `${Math.round(n).toLocaleString("en-US")} ل.ل`
    : `$${Number(n).toFixed(2)}`;
}

// People, hours and pay for a shop that runs on six workers and a notebook.
//
// Deliberately one screen. A separate module each for employees, attendance,
// advances and payroll would be tidier to build and useless to a butcher at
// 6am: the whole job is "who is here, who took money, what do I owe".
export function HrManager({
  storeId,
  clockHref,
  residencyCutoff,
  employees,
  runs,
  labels,
}: {
  storeId: string;
  clockHref: string;
  /** ISO date 30 days out, computed on the server — reading the clock during
   *  render is impure and React rightly refuses it. */
  residencyCutoff: string;
  employees: Employee[];
  runs: PayrollRun[];
  labels: L;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    job_title: "",
    pay_basis: "monthly",
    pay_rate: "",
    pay_currency: "USD",
  });

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  const [from, setFrom] = useState(iso(monthStart));
  const [to, setTo] = useState(iso(monthEnd));

  async function addEmployee() {
    if (!form.name.trim()) {
      notifyError(labels.needName);
      return;
    }
    setBusy("add");
    const { error } = await createClient().from("store_employees").insert({
      store_id: storeId,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      job_title: form.job_title.trim() || null,
      pay_basis: form.pay_basis,
      pay_rate: Number(form.pay_rate) || 0,
      pay_currency: form.pay_currency,
    });
    setBusy(null);
    if (error) {
      notifyError(labels.error);
      return;
    }
    setForm({
      name: "",
      phone: "",
      job_title: "",
      pay_basis: "monthly",
      pay_rate: "",
      pay_currency: "USD",
    });
    setAdding(false);
    router.refresh();
  }

  // No PIN typed here: a manager pressing this is recorded as a manager punch,
  // which is exactly what it is.
  async function clock(employeeId: string) {
    setBusy(employeeId);
    const { error } = await createClient().rpc("employee_clock", {
      p_store_id: storeId,
      p_employee_id: employeeId,
      p_pin: null,
      p_lat: null,
      p_lng: null,
    });
    setBusy(null);
    if (error) {
      notifyError(labels.error);
      return;
    }
    router.refresh();
  }

  async function setPin(employeeId: string) {
    const pin = window.prompt(labels.pinPrompt);
    if (pin === null) return;
    setBusy(employeeId);
    const { error } = await createClient().rpc("set_employee_pin", {
      p_employee_id: employeeId,
      p_pin: pin.trim(),
    });
    setBusy(null);
    if (error) {
      notifyError(
        (error.message ?? "").includes("bad_pin") ? labels.pinBad : labels.error,
      );
      return;
    }
    notifySuccess(labels.pinSaved);
    router.refresh();
  }

  async function addAdvance(employeeId: string, currency: string) {
    const raw = window.prompt(labels.advancePrompt);
    if (raw === null) return;
    const amount = Number(raw);
    if (!amount || amount <= 0) return;
    setBusy(employeeId);
    const { error } = await createClient().from("employee_advances").insert({
      store_id: storeId,
      employee_id: employeeId,
      amount,
      currency,
    });
    setBusy(null);
    if (error) {
      notifyError(labels.error);
      return;
    }
    notifySuccess(labels.advanceSaved);
    router.refresh();
  }

  async function buildPayroll() {
    setBusy("payroll");
    const { error } = await createClient().rpc("build_payroll", {
      p_store_id: storeId,
      p_from: from,
      p_to: to,
    });
    setBusy(null);
    if (error) {
      notifyError(
        (error.message ?? "").includes("period_already_posted")
          ? labels.alreadyPosted
          : labels.error,
      );
      return;
    }
    router.refresh();
  }

  async function postPayroll(runId: string) {
    const ok = await confirm({
      message: labels.postConfirm,
      confirmLabel: labels.postYes,
      cancelLabel: labels.postNo,
      danger: true,
    });
    if (!ok) return;
    setBusy(runId);
    const { error } = await createClient().rpc("post_payroll", {
      p_run_id: runId,
    });
    setBusy(null);
    if (error) {
      notifyError(labels.error);
      return;
    }
    notifySuccess(labels.postDone);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* ===== People ===== */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">{labels.peopleTitle}</h2>
          <span className="flex items-center gap-2">
            {/* The tablet by the door. Only useful once someone has a PIN, so it
                is a quiet link rather than a headline button. */}
            <a
              href={clockHref}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold transition-colors hover:border-primary hover:text-primary"
            >
              {labels.kioskTitle}
            </a>
            <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
              <UserPlus className="h-4 w-4" />
              {labels.addEmployee}
            </Button>
          </span>
        </div>

        {adding && (
          <div className="mt-4 grid gap-2 rounded-xl border border-border bg-surface-muted/40 p-3 sm:grid-cols-2">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={labels.fName}
              className={fieldClass}
            />
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder={labels.fPhone}
              className={fieldClass}
              dir="ltr"
            />
            <input
              value={form.job_title}
              onChange={(e) => setForm({ ...form, job_title: e.target.value })}
              placeholder={labels.fJob}
              className={fieldClass}
            />
            <select
              value={form.pay_basis}
              onChange={(e) => setForm({ ...form, pay_basis: e.target.value })}
              className={fieldClass}
            >
              <option value="monthly">{labels.basisMonthly}</option>
              <option value="daily">{labels.basisDaily}</option>
              <option value="hourly">{labels.basisHourly}</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.pay_rate}
              onChange={(e) => setForm({ ...form, pay_rate: e.target.value })}
              placeholder={labels.fRate}
              className={fieldClass}
            />
            <select
              value={form.pay_currency}
              onChange={(e) =>
                setForm({ ...form, pay_currency: e.target.value })
              }
              className={fieldClass}
            >
              <option value="USD">USD</option>
              <option value="LBP">LBP</option>
            </select>
            <div className="sm:col-span-2">
              <Button onClick={addEmployee} loading={busy === "add"}>
                {labels.save}
              </Button>
            </div>
          </div>
        )}

        {employees.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{labels.noPeople}</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {employees.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 py-3">
                <div className="min-w-40 flex-1">
                  <p className="font-bold">
                    {e.name}
                    {e.on_shift && (
                      <span className="ms-2 rounded-full bg-success-soft px-2 py-0.5 text-xs font-bold text-success">
                        {labels.onShift}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      e.job_title,
                      `${money(Number(e.pay_rate), e.pay_currency)} / ${
                        labels[
                          e.pay_basis === "monthly"
                            ? "perMonth"
                            : e.pay_basis === "daily"
                              ? "perDay"
                              : "perHour"
                        ]
                      }`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {/* A lapsed permit is the shop's problem, not just the
                      worker's, so it is said out loud rather than filed away. */}
                  {e.residency_expires_on &&
                    e.residency_expires_on <= residencyCutoff && (
                      <p className="mt-0.5 text-xs font-bold text-warning">
                        {labels.residencySoon.replace(
                          "{d}",
                          e.residency_expires_on,
                        )}
                      </p>
                    )}
                </div>
                <Button
                  size="sm"
                  variant={e.on_shift ? "outline" : "primary"}
                  disabled={busy === e.id}
                  onClick={() => clock(e.id)}
                >
                  {e.on_shift ? (
                    <LogOut className="h-4 w-4" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  {e.on_shift ? labels.clockOut : labels.clockIn}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === e.id}
                  onClick={() => addAdvance(e.id, e.pay_currency)}
                >
                  <Wallet className="h-4 w-4" />
                  {labels.advance}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === e.id}
                  onClick={() => setPin(e.id)}
                >
                  <KeyRound className="h-4 w-4" />
                  {e.has_pin ? labels.pinChange : labels.pinSet}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ===== Payroll ===== */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-bold">{labels.payrollTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{labels.payrollBody}</p>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={`${fieldClass} max-w-44`}
            dir="ltr"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={`${fieldClass} max-w-44`}
            dir="ltr"
          />
          <Button
            variant="outline"
            onClick={buildPayroll}
            loading={busy === "payroll"}
          >
            <Calculator className="h-4 w-4" />
            {labels.calculate}
          </Button>
        </div>

        {runs.map((run) => (
          <div
            key={run.id}
            className="mt-4 rounded-xl border border-border bg-surface-muted/30 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold" dir="ltr">
                {run.period_start} → {run.period_end}
              </span>
              {run.status === "posted" ? (
                <span className="flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {labels.posted}
                </span>
              ) : (
                <Button
                  size="sm"
                  disabled={busy === run.id}
                  onClick={() => postPayroll(run.id)}
                >
                  {labels.post}
                </Button>
              )}
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-md text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-bold text-muted-foreground">
                    <th className="pb-2 text-start">{labels.colName}</th>
                    <th className="pb-2 text-center">{labels.colDays}</th>
                    <th className="pb-2 text-center">{labels.colHours}</th>
                    <th className="pb-2 text-end">{labels.colGross}</th>
                    <th className="pb-2 text-end">{labels.colAdvances}</th>
                    <th className="pb-2 text-end">{labels.colNet}</th>
                  </tr>
                </thead>
                <tbody>
                  {run.lines.map((l, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 font-semibold">{l.employee_name}</td>
                      <td className="py-2 text-center tabular-nums">
                        {l.days_worked}
                      </td>
                      <td className="py-2 text-center tabular-nums">
                        {(l.minutes_worked / 60).toFixed(1)}
                      </td>
                      <td className="py-2 text-end tabular-nums">
                        {money(Number(l.gross), l.currency)}
                      </td>
                      <td className="py-2 text-end tabular-nums text-danger">
                        {Number(l.advances) > 0
                          ? `-${money(Number(l.advances), l.currency)}`
                          : "—"}
                      </td>
                      <td className="py-2 text-end font-bold tabular-nums">
                        {money(Number(l.net), l.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-2 text-sm font-bold">
              {labels.total}: {money(Number(run.total_usd), "USD")}
              {Number(run.total_lbp) > 0 && (
                <span className="ms-2">
                  + {money(Number(run.total_lbp), "LBP")}
                </span>
              )}
            </p>
            {/* Only dollars reach the expense ledger, because expenses carry one
                amount and no currency. Saying so beats a total that quietly
                misses part of the wage bill. */}
            {Number(run.total_lbp) > 0 && (
              <p className="mt-1 text-xs text-warning">{labels.lbpNote}</p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
