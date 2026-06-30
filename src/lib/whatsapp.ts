// WhatsApp is the dominant ordering channel in Lebanon. These helpers build a
// click-to-chat link with a pre-filled message — no backend, no API.

/** Build a wa.me link to a phone number with a pre-filled message. */
export function waLink(phone: string, text: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export type WaLine = { name: string; qty: number; lineTotal: string };

/** Compose an order message: greeting + store, line items, total, optional address. */
export function buildOrderMessage(opts: {
  greeting: string;
  storeName: string;
  lines: WaLine[];
  totalLabel: string;
  total: string;
  address?: string | null;
}): string {
  const parts = [`${opts.greeting} ${opts.storeName}`, ""];
  for (const l of opts.lines) {
    parts.push(`• ${l.name} ×${l.qty} — ${l.lineTotal}`);
  }
  parts.push("", `${opts.totalLabel}: ${opts.total}`);
  if (opts.address) parts.push(opts.address);
  return parts.join("\n");
}
