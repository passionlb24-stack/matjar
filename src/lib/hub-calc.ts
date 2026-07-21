// Pure, unit-tested math behind the Hub calculators. Kept out of the components
// so the logic can be verified deterministically (the calculators are otherwise
// only exercisable through a live browser).

export type ProfitResult = {
  unit: number;
  margin: number; // % of selling price
  markup: number; // % over cost
  revenue: number;
  profit: number;
  loss: boolean;
};

export function computeProfit(cost: number, price: number, qty: number): ProfitResult {
  const q = Math.max(1, qty || 1);
  const unit = price - cost;
  return {
    unit,
    margin: price !== 0 ? (unit / price) * 100 : 0,
    markup: cost !== 0 ? (unit / cost) * 100 : 0,
    revenue: price * q,
    profit: unit * q,
    loss: unit < 0,
  };
}

export type PriceResult = { final: number; profit: number };

/** Price to charge so that `marginPct`% of the price is profit, plus optional
 *  pass-through `extraPct` (tax/fees) on top. Margin must be in [0, 100). */
export function computePrice(cost: number, marginPct: number, extraPct: number): PriceResult | null {
  if (!(cost > 0) || !(marginPct >= 0 && marginPct < 100)) return null;
  const base = cost / (1 - marginPct / 100);
  return { final: base * (1 + (extraPct || 0) / 100), profit: base - cost };
}
