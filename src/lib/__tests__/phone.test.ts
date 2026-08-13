import { describe, expect, it } from "vitest";
import { waNumber, waLink } from "../phone";

// The cases are the numbers actually stored on live stores today —
// 81457806, 71757701, 03709064 — plus the shapes a merchant might type.
describe("waNumber", () => {
  it("prefixes a bare local mobile with the country code", () => {
    expect(waNumber("81457806")).toBe("96181457806");
    expect(waNumber("71757701")).toBe("96171757701");
  });

  it("drops the trunk zero before adding the country code", () => {
    // 03709064 must become 961 3709064, never 961 03709064.
    expect(waNumber("03709064")).toBe("9613709064");
  });

  it("leaves an already-international number alone", () => {
    expect(waNumber("96181457806")).toBe("96181457806");
    expect(waNumber("+961 81 457 806")).toBe("96181457806");
  });

  it("ignores spaces, dashes and parentheses", () => {
    expect(waNumber("03-709 064")).toBe("9613709064");
    expect(waNumber("(81) 457-806")).toBe("96181457806");
  });

  it("returns null when there is nothing dialable", () => {
    expect(waNumber(null)).toBeNull();
    expect(waNumber(undefined)).toBeNull();
    expect(waNumber("")).toBeNull();
    expect(waNumber("—")).toBeNull();
    expect(waNumber("12345")).toBeNull();
  });
});

describe("waLink", () => {
  it("builds a usable wa.me url", () => {
    expect(waLink("03709064")).toBe("https://wa.me/9613709064");
  });

  it("encodes an optional message", () => {
    expect(waLink("81457806", "مرحبا")).toBe(
      "https://wa.me/96181457806?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7",
    );
  });

  it("returns null rather than a link to nowhere", () => {
    expect(waLink(null)).toBeNull();
  });
});
