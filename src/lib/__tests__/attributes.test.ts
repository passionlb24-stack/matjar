import { describe, it, expect } from "vitest";
import { attributeSummary } from "@/lib/attributes";

describe("attributeSummary", () => {
  it("builds a dotted summary in Arabic for real estate", () => {
    const s = attributeSummary(
      "realEstate",
      { rooms: "3", area: "140", bathrooms: "2" },
      "ar",
    );
    expect(s).toBe("3 غرف · 140 المساحة (م²) · 2 حمّامات");
  });

  it("uses English labels and skips missing fields", () => {
    const s = attributeSummary("automotive", { brand: "Kia", year: "2018" }, "en");
    expect(s).toBe("Kia Brand · 2018 Year");
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
