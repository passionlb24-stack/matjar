// Barcode validity, as a rule rather than as a side effect of trying to draw one.
//
// The generator used to record validity in state after JsBarcode threw, which
// left a render where the drawn barcode and the error message disagreed. Here it
// is a function of the typed value, so the two can never diverge.

/**
 * EAN-13's 13th digit is a checksum over the first 12: digits alternate weight
 * 1 and 3, and the check digit is what rounds the sum up to a multiple of 10.
 * JsBarcode rejects a 13-digit code whose check digit doesn't match, so the same
 * rule has to live here or the two would disagree about what is valid.
 */
export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

/** CODE128 takes any text; EAN-13 wants 12 digits, or 13 with a correct check. */
export function isValidBarcode(value: string, format: string): boolean {
  if (!value) return false;
  if (format !== "EAN13") return true;
  if (!/^\d{12,13}$/.test(value)) return false;
  // 12 digits: JsBarcode appends the checksum itself.
  return (
    value.length === 12 || Number(value[12]) === ean13CheckDigit(value.slice(0, 12))
  );
}
