"use client";

import { Printer } from "lucide-react";

// Opens the browser print dialog (Save as PDF) for the order detail, which is
// laid out as a receipt. Header/footer/action buttons are print:hidden.
export function PrintInvoiceButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-bold transition-colors hover:border-primary hover:text-primary print:hidden"
    >
      <Printer className="h-4 w-4" />
      {label}
    </button>
  );
}
