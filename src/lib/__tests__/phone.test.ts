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

// Every number below is a real value stored on a live store today. Four of the
// eleven produced a link that could not open, which matters because the whole
// promise of a WhatsApp button on a storefront is one tap.
describe("the shapes real merchants actually stored", () => {
  it("drops a trunk zero that sits behind the country code", () => {
    // Was 96103434661 — WhatsApp cannot resolve 961 0 3434661.
    expect(waNumber("+96103434661")).toBe("9613434661");
    expect(waNumber("+96103102164")).toBe("9613102164");
  });

  it("handles the 00 international access prefix", () => {
    // Was 961096171627323: one zero stripped off "00", the rest left in.
    expect(waNumber("0096171627323")).toBe("96171627323");
  });

  it("refuses a number too short to ring instead of inventing one", () => {
    // Was 961961102164 — the country code prepended onto a string that already
    // began with it. Six national digits is not a Lebanese number.
    expect(waNumber("+961102164")).toBeNull();
  });

  it("still handles the ordinary ones unchanged", () => {
    expect(waNumber("76150332")).toBe("96176150332");
    expect(waNumber("06 424 911")).toBe("9616424911");
    expect(waNumber("03172745")).toBe("9613172745");
    expect(waNumber("+96176373577")).toBe("96176373577");
    expect(waNumber("71793516")).toBe("96171793516");
  });

  it("does not mistake a Keserwan landline for a country code", () => {
    // Area code 09, so the national number legitimately begins 961 once the
    // trunk zero is gone. Stripping on the prefix alone would leave 2345.
    expect(waNumber("09612345")).toBe("9619612345");
    expect(waNumber("9612345")).toBe("9619612345");
  });
});
