import { describe, it, expect } from "vitest";
import { localeAlternates } from "@/lib/site";

describe("localeAlternates", () => {
  it("builds canonical + ar/en/x-default for a content path", () => {
    const a = localeAlternates("ar", "/store/123");
    expect(a.canonical).toBe("/ar/store/123");
    expect(a.languages.ar).toBe("/ar/store/123");
    expect(a.languages.en).toBe("/en/store/123");
    expect(a.languages["x-default"]).toBe("/ar/store/123");
  });

  it("treats the home path as the locale root (no trailing slash)", () => {
    const a = localeAlternates("en", "");
    expect(a.canonical).toBe("/en");
    expect(a.languages.ar).toBe("/ar");
    expect(a.languages["x-default"]).toBe("/ar");
  });

  it("collapses a single-slash path to the root", () => {
    expect(localeAlternates("ar", "/").canonical).toBe("/ar");
  });
});
