"use client";

// Spreadsheet import: template -> upload -> review -> confirm.
//
// Nothing is written until the merchant sees what will happen. The parse and
// the review are local; only the confirmed rows reach import_products(), which
// re-validates and enforces the plan cap itself (0214) — this screen is the
// explanation, not the gate.
//
// Free and Basic stores can still upload and review. Seeing "147 products ready"
// and then the cap is a far better upgrade prompt than a disabled button, and the
// Pro requirement is stated before they pick a file, so nothing is sprung on them.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Download,
  Upload,
  Check,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";
import { revalidateProduct, revalidateStore } from "@/lib/cache-actions";
import type { Dictionary } from "@/i18n/get-dictionary";
import {
  IMPORT_COLUMNS,
  matchHeaders,
  hasRequiredColumns,
  reviewRows,
  countNew,
  type RawRow,
  type RowError,
} from "@/lib/product-import";

type Review = {
  filename: string;
  ok: RawRow[];
  problems: { index: number; error: RowError }[];
  newCount: number;
};

export function ProductImportClient({
  storeId,
  lang,
  canImport,
  planLimit,
  existingCount,
  existingSkus,
  dict,
}: {
  storeId: string;
  lang: string;
  canImport: boolean;
  planLimit: number;
  existingCount: number;
  existingSkus: string[];
  dict: Dictionary;
}) {
  const router = useRouter();
  const t = dict.merchant.productImport;
  const [busy, setBusy] = useState<"reading" | "importing" | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [done, setDone] = useState<{ created: number; updated: number } | null>(
    null,
  );
  const [capError, setCapError] = useState<string | null>(null);

  const fill = (s: string, vars: Record<string, string | number>) =>
    Object.entries(vars).reduce(
      (out, [k, v]) => out.replace(`{${k}}`, String(v)),
      s,
    );

  // ── Template ─────────────────────────────────────────────────────────────
  async function downloadTemplate() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Products", {
      views: [{ rightToLeft: lang === "ar" }],
    });

    const headers = IMPORT_COLUMNS.map((c) => (lang === "ar" ? c.ar : c.en));
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    ws.columns = headers.map(() => ({ width: 18 }));

    // Two filled rows, because an empty template is a guessing game about what
    // each column wants.
    ws.addRow(["TS-001", "تي شيرت قطن", "12.5", "40", "9.99", "ملابس", "", "", "", "Cotton T-shirt", ""]);
    ws.addRow(["MG-002", "مغ سيراميك", "6", "15", "", "مطبخ", "", "", "", "Ceramic mug", ""]);

    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "matjar-products-template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Upload + parse ───────────────────────────────────────────────────────
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again after a fix
    if (!file) return;

    setBusy("reading");
    setCapError(null);
    setDone(null);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws || ws.rowCount < 1) {
        notifyError(t.emptyFile);
        setBusy(null);
        return;
      }

      const headerCells: unknown[] = [];
      ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
        headerCells[col - 1] = cell.text;
      });
      const found = matchHeaders(headerCells);
      if (!hasRequiredColumns(found)) {
        notifyError(t.noHeaders);
        setBusy(null);
        return;
      }

      const rows: RawRow[] = [];
      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const raw: RawRow = {};
        let any = false;
        for (const col of IMPORT_COLUMNS) {
          const idx = found[col.key];
          if (idx === undefined) continue;
          const text = String(row.getCell(idx + 1).text ?? "").trim();
          if (text) {
            raw[col.key] = text;
            any = true;
          }
        }
        if (any) rows.push(raw); // skip the blank rows Excel leaves behind
      }

      if (rows.length === 0) {
        notifyError(t.emptyFile);
        setBusy(null);
        return;
      }

      const { ok, problems } = reviewRows(rows);
      setReview({
        filename: file.name,
        ok,
        problems,
        newCount: countNew(ok, new Set(existingSkus)),
      });
    } catch {
      notifyError(t.badFile);
    } finally {
      setBusy(null);
    }
  }

  // ── Confirm ──────────────────────────────────────────────────────────────
  async function confirmImport() {
    if (!review || review.ok.length === 0) return;
    setBusy("importing");
    setCapError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("import_products", {
      p_store_id: storeId,
      p_rows: review.ok,
      p_filename: review.filename,
    });
    setBusy(null);

    if (error) {
      notifyError(error.message || dict.auth.errorGeneric);
      return;
    }
    const res = data as {
      ok: boolean;
      code?: string;
      created?: number;
      updated?: number;
      existing?: number;
      adding?: number;
      limit?: number;
    };
    if (!res?.ok) {
      if (res?.code === "plan_limit") {
        setCapError(
          fill(t.planLimit, {
            existing: res.existing ?? 0,
            adding: res.adding ?? 0,
            limit: res.limit ?? 0,
          }),
        );
      } else {
        notifyError(dict.auth.errorGeneric);
      }
      return;
    }
    setReview(null);
    setDone({ created: res.created ?? 0, updated: res.updated ?? 0 });
    // Without this the merchant checks their storefront, sees the old catalogue
    // for up to five minutes, and concludes the import failed — right after the
    // moment the feature was supposed to win them over.
    await revalidateProduct();
    await revalidateStore(storeId);
    router.refresh();
  }

  const card = "rounded-2xl border border-border bg-surface p-5 shadow-sm";
  const errLabel: Record<RowError, string> = {
    errName: t.errName,
    errPrice: t.errPrice,
    errDiscount: t.errDiscount,
    errCost: t.errCost,
    errStock: t.errStock,
  };

  // ── Done ─────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className={card}>
        <p className="flex items-center gap-2 font-bold text-primary">
          <Check className="h-5 w-5" />
          {fill(t.done, { created: done.created, updated: done.updated })}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/${lang}/merchant/${storeId}/items`}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {t.backToProducts}
          </Link>
          <button
            type="button"
            onClick={() => setDone(null)}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted/40"
          >
            {t.startOver}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!canImport && (
        <div className={`${card} border-primary/30 bg-primary-soft/20`}>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Lock className="h-4 w-4 text-primary" />
            {t.locked}
          </p>
          <Link
            href={`/${lang}/merchant/${storeId}/subscription`}
            className="mt-3 inline-block rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {t.lockedCta}
          </Link>
        </div>
      )}

      {/* Step 1 */}
      <div className={card}>
        <h2 className="text-sm font-bold">{t.step1}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.step1Body}</p>
        <button
          type="button"
          onClick={downloadTemplate}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted/40"
        >
          <Download className="h-4 w-4" />
          {t.download}
        </button>

        <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
          <li>• {t.noteSku}</li>
          <li>• {t.noteImages}</li>
          <li>• {t.noteVariants}</li>
        </ul>
      </div>

      {/* Step 2 */}
      <div className={card}>
        <h2 className="text-sm font-bold">{t.step2}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.step2Body}</p>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted/40">
          <Upload className="h-4 w-4" />
          {busy === "reading" ? t.reading : t.choose}
          <input
            type="file"
            accept=".xlsx"
            onChange={onFile}
            disabled={busy !== null}
            className="hidden"
          />
        </label>
      </div>

      {/* Step 3 */}
      {review && (
        <div className={card}>
          <h2 className="text-sm font-bold">{t.step3}</h2>
          <p className="mt-2 text-2xl font-extrabold">
            {fill(t.ready, { n: review.ok.length })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {fill(t.willCreate, { n: review.newCount })} ·{" "}
            {fill(t.willUpdate, { n: review.ok.length - review.newCount })}
          </p>

          {review.problems.length > 0 && (
            <div className="mt-4 rounded-xl border border-warning/30 bg-warning-soft/30 p-3">
              <p className="flex items-center gap-1.5 text-sm font-bold text-warning">
                <AlertTriangle className="h-4 w-4" />
                {fill(t.problems, { n: review.problems.length })}
              </p>
              <ul className="mt-2 space-y-0.5 text-xs">
                {review.problems.slice(0, 12).map((p) => (
                  <li key={p.index}>
                    {fill(t.rowError, { row: p.index })} — {errLabel[p.error]}
                  </li>
                ))}
                {review.problems.length > 12 && (
                  <li className="text-muted-foreground">
                    +{review.problems.length - 12}
                  </li>
                )}
              </ul>
            </div>
          )}

          {capError && (
            <p className="mt-4 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm font-semibold text-danger">
              {capError}
            </p>
          )}

          {/* The cap the merchant is about to hit, shown before they hit it. */}
          {canImport && existingCount + review.newCount > planLimit && !capError && (
            <p className="mt-4 rounded-xl border border-warning/30 bg-warning-soft/30 p-3 text-sm font-semibold text-warning">
              {fill(t.planLimit, {
                existing: existingCount,
                adding: review.newCount,
                limit: planLimit,
              })}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {canImport ? (
              <button
                type="button"
                onClick={confirmImport}
                disabled={busy !== null || review.ok.length === 0}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
              >
                {busy === "importing" ? t.importing : t.confirm}
              </button>
            ) : (
              <Link
                href={`/${lang}/merchant/${storeId}/subscription`}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                {t.lockedCta}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setReview(null)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted/40"
            >
              {t.startOver}
            </button>
          </div>
        </div>
      )}

      <div className={card}>
        <h2 className="flex items-center gap-1.5 text-sm font-bold">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          {t.columns}
        </h2>
        <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          {IMPORT_COLUMNS.map((c) => (
            <li key={c.key} className="flex items-center gap-2">
              <span className="font-semibold">
                {lang === "ar" ? c.ar : c.en}
              </span>
              <span className="text-xs text-muted-foreground">
                {c.required ? t.required : t.optional}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
