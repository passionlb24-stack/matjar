import { describe, it, expect } from "vitest";
import { attributeSummary } from "@/lib/attributes";

describe("attributeSummary", () => {
  it("builds a dotted summary in Arabic for real estate, in field order with units", () => {
    const s = attributeSummary(
      "realEstate",
      { rooms: "3", area: "140", bathrooms: "2" },
      "ar",
    );
    expect(s).toBe("3 غرف · 2 حمّام · 140 م²");
  });

  it("translates select values and skips missing fields", () => {
    const s = attributeSummary(
      "automotive",
      { brand: "Kia", year: "2018", fuel: "diesel" },
      "en",
    );
    expect(s).toBe("Kia · 2018 · Diesel");
  });

  it("returns empty for a category with no attribute schema", () => {
    expect(attributeSummary("food", { anything: "x" }, "ar")).toBe("");
  });

  it("returns empty when attributes are null/undefined", () => {
    expect(attributeSummary("automotive", null, "en")).toBe("");
    expect(attributeSummary("automotive", undefined, "ar")).toBe("");
  });

  it("returns empty when no known field has a value", () => {
    expect(attributeSummary("automotive", { unknown: "x" }, "en")).toBe("");
  });
});
