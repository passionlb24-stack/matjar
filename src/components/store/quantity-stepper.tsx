"use client";

import { Minus, Plus } from "lucide-react";
import type { Locale } from "@/i18n/config";
import {
  unitPricingOf,
  formatQuantityMeasure,
  type UnitPricedRow,
} from "@/lib/unit-pricing";

// The − n + control, in one place because it is rendered in two.
//
// The product list and the cart sheet both step quantities, and before this
// they did it with the same inner function closed over the same state. Now they
// call the same module. That is the point of the move: a quantity change is one
// code path, not two that can disagree.
//
// The number it holds is still the integer `quantity` the RPC receives. Nothing
// about what the stepper reports changed; only where the component lives.
export function QuantityStepper({
  product,
  qty,
  lang,
  onChange,
}: {
  /** Read for two things only: the stock ceiling and the unit label. */
  product: UnitPricedRow & { stock?: number | null };
  qty: number;
  lang: Locale;
  onChange: (qty: number) => void;
}) {
  const atMax = product.stock != null && qty >= product.stock;
  // A weight-sold line counts in kilos, not in nameless units. The stepper
  // still increments the same integer the RPC receives — only the label between
  // the buttons changes, from "2" to "2 كيلو". Rendered LTR with tabular
  // figures for the same bidi reason money is: "500 غ" inside an RTL row
  // otherwise resolves its number and its unit against each other.
  const unit = unitPricingOf(product);
  const readout = unit
    ? formatQuantityMeasure(unit, qty, lang === "ar" ? "ar" : "en")
    : String(qty);
  return (
    <div className="flex items-center gap-2">
      {/* 32px squares are what the design wants and 44px is what a thumb
          needs, so the hit area is extended with a transparent pseudo-element
          rather than growing the buttons. These are the most-tapped controls
          in the whole shopping flow. */}
      <button
        onClick={() => onChange(qty - 1)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-surface-muted"
        aria-label="-"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span
        dir="ltr"
        className={`text-center font-bold tabular-nums ${unit ? "min-w-16" : "w-5"}`}
      >
        {readout}
      </span>
      <button
        onClick={() => onChange(qty + 1)}
        disabled={atMax}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="+"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
