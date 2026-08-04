import { describe, it, expect } from "vitest";
import { ean13CheckDigit, isValidBarcode } from "@/lib/barcode";

describe("ean13CheckDigit", () => {
  it("computes the published check digit for known codes", () => {
    // 5901234123457 — the example in the EAN-13 specification.
    expect(ean13CheckDigit("590123412345")).toBe(7);
    // 4006381333931 — a widely used reference barcode.
    expect(ean13CheckDigit("400638133393")).toBe(1);
  });

  it("returns 0 when the weighted sum is already a multiple of 10", () => {
    // Guards the (10 - sum % 10) % 10 wrap: without the outer % 10 this is 10.
    expect(ean13CheckDigit("000000000000")).toBe(0);
  });

  it("weights alternate digits by 1 and 3", () => {
    // Only the second digit differs, and it sits on a weight-3 position.
    expect(ean13CheckDigit("010000000000")).not.toBe(
      ean13CheckDigit("100000000000"),
    );
  });
});

describe("isValidBarcode", () => {
  it("takes any non-empty text as CODE128", () => {
    expect(isValidBarcode("MATJAR-001", "CODE128")).toBe(true);
    expect(isValidBarcode("قميص أزرق", "CODE128")).toBe(true);
  });

  it("rejects an empty value in any format", () => {
    expect(isValidBarcode("", "CODE128")).toBe(false);
    expect(isValidBarcode("", "EAN13")).toBe(false);
  });

  it("accepts 12 digits as EAN-13, since the checksum is appended for us", () => {
    expect(isValidBarcode("590123412345", "EAN13")).toBe(true);
  });

  it("accepts 13 digits only when the check digit is right", () => {
    expect(isValidBarcode("5901234123457", "EAN13")).toBe(true);
    // Same code, wrong final digit — this is the case a length check misses.
    expect(isValidBarcode("5901234123456", "EAN13")).toBe(false);
  });

  it("rejects EAN-13 values that aren't 12–13 digits", () => {
    expect(isValidBarcode("12345", "EAN13")).toBe(false);
    expect(isValidBarcode("59012341234567", "EAN13")).toBe(false);
    expect(isValidBarcode("59012341234A", "EAN13")).toBe(false);
    expect(isValidBarcode("MATJAR-001", "EAN13")).toBe(false);
  });
});
