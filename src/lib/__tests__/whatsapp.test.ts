import { describe, it, expect } from "vitest";
import { waLink, buildOrderMessage } from "@/lib/whatsapp";

describe("waLink", () => {
  it("strips non-digits from the phone and encodes the text", () => {
    const link = waLink("+961 70 123 456", "hi there");
    expect(link).toBe("https://wa.me/96170123456?text=hi%20there");
  });
});

describe("buildOrderMessage", () => {
  it("composes greeting, line items, and total", () => {
    const msg = buildOrderMessage({
      greeting: "Order from",
      storeName: "Nazih Home",
      lines: [
        { name: "Chair", qty: 2, lineTotal: "$40" },
        { name: "Lamp", qty: 1, lineTotal: "$15" },
      ],
      totalLabel: "Total",
      total: "$55",
    });
    expect(msg).toContain("Order from Nazih Home");
    expect(msg).toContain("• Chair ×2 — $40");
    expect(msg).toContain("• Lamp ×1 — $15");
    expect(msg).toContain("Total: $55");
  });

  it("appends the address when provided", () => {
    const msg = buildOrderMessage({
      greeting: "Order from",
      storeName: "S",
      lines: [],
      totalLabel: "Total",
      total: "$0",
      address: "Hamra, Beirut",
    });
    expect(msg).toContain("Hamra, Beirut");
  });

  it("omits the address line when absent", () => {
    const msg = buildOrderMessage({
      greeting: "Order from",
      storeName: "S",
      lines: [],
      totalLabel: "Total",
      total: "$0",
    });
    expect(msg.endsWith("Total: $0")).toBe(true);
  });
});
