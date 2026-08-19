import { describe, it, expect, vi, afterEach } from "vitest";
import { FETCH_BOUNDS, warnIfTruncated } from "@/lib/data/bounds";

afterEach(() => {
  vi.restoreAllMocks();
});

function captureWarn(fn: () => void): string[] {
  const calls: string[] = [];
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    calls.push(args.join(" "));
  });
  fn();
  return calls;
}

describe("warnIfTruncated", () => {
  it("stays quiet below the ceiling — the normal case", () => {
    expect(captureWarn(() => warnIfTruncated(new Array(9), 10, "x"))).toEqual([]);
  });

  it("stays quiet for empty and nullish results", () => {
    expect(captureWarn(() => warnIfTruncated([], 10, "x"))).toEqual([]);
    expect(captureWarn(() => warnIfTruncated(null, 10, "x"))).toEqual([]);
    expect(captureWarn(() => warnIfTruncated(undefined, 10, "x"))).toEqual([]);
  });

  it("fires the moment a fetch comes back full", () => {
    // A full page is the only observable PostgREST gives us: it returns a
    // truncated array with no error, so "length === limit" is the alarm.
    const out = captureWarn(() => warnIfTruncated(new Array(10), 10, "product_variants"));
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("product_variants");
    expect(out[0]).toContain("10");
  });

  it("names the surface and the bound so the fix is obvious", () => {
    const [msg] = captureWarn(() =>
      warnIfTruncated(new Array(200), 200, "products (store abc)"),
    );
    expect(msg).toContain("products (store abc)");
    expect(msg).toContain("src/lib/data/bounds.ts");
    expect(msg).toContain("NOT rendered");
  });

  it("still fires if a bound is somehow overshot", () => {
    expect(captureWarn(() => warnIfTruncated(new Array(12), 10, "x"))).toHaveLength(1);
  });
});

describe("FETCH_BOUNDS", () => {
  it("gives every surface a positive integer ceiling", () => {
    const entries = Object.entries(FETCH_BOUNDS);
    expect(entries.length).toBeGreaterThan(0);
    for (const [name, limit] of entries) {
      expect(Number.isInteger(limit), `${name} must be an integer`).toBe(true);
      expect(limit, `${name} must be positive`).toBeGreaterThan(0);
    }
  });

  it("keeps every ceiling far above what one entity plausibly holds", () => {
    // The point of these bounds is to be unreachable in normal operation, so a
    // warning always means something genuinely unusual — never routine noise.
    // 50 is the floor: a single product with 50 modifier groups, or a store
    // with 50 custom checkout fields, is already past anything sane.
    for (const [name, limit] of Object.entries(FETCH_BOUNDS)) {
      expect(limit, `${name} is too tight to stay quiet`).toBeGreaterThanOrEqual(50);
    }
  });

  it("scales the platform-wide rollups past today's totals with room to grow", () => {
    // 36 stores / 63 products today. These aggregate every store at once, so
    // they must clear the whole platform, not one entity.
    for (const name of ["allProducts", "allStoreSections", "allProviders"] as const) {
      expect(FETCH_BOUNDS[name], `${name} must clear platform scale`).toBeGreaterThanOrEqual(5000);
    }
  });

  it("bounds the whole-store surfaces above PostgREST's silent 1000-row default", () => {
    // These are the MP-039/MP-040 sites: below 1000 they would tighten today's
    // effective behaviour rather than merely make it explicit.
    expect(FETCH_BOUNDS.storeProducts).toBeGreaterThanOrEqual(1000);
    expect(FETCH_BOUNDS.storeVariants).toBeGreaterThanOrEqual(1000);
    expect(FETCH_BOUNDS.allProducts).toBeGreaterThanOrEqual(1000);
  });
});
