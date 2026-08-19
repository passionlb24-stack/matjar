import { describe, it, expect } from "vitest";
import {
  storeIntakeFields,
  publishStage,
  isFirstRun,
} from "@/lib/store-onboarding";
import { resolveStoreModules, sectorConfig } from "@/lib/sectors";
import type { CategoryKey } from "@/lib/catalog";

const fieldsFor = (category: CategoryKey) =>
  storeIntakeFields(category, resolveStoreModules(category));

const ALL_SECTORS = Object.keys(sectorConfig) as CategoryKey[];

describe("storeIntakeFields", () => {
  it("asks a restaurant and a clinic different questions", () => {
    const food = fieldsFor("food");
    const clinic = fieldsFor("healthcare");
    expect(food).toContain("fulfillment");
    expect(food).not.toContain("specialties");
    expect(clinic).toContain("specialties");
    expect(clinic).not.toContain("fulfillment");
  });

  it("asks where you are only where the location module is on", () => {
    for (const category of ALL_SECTORS) {
      const asked = fieldsFor(category).includes("region");
      expect(asked).toBe(resolveStoreModules(category).has("location"));
    }
  });

  it("asks about delivery only where the delivery module is on", () => {
    for (const category of ALL_SECTORS) {
      const asked = fieldsFor(category).includes("fulfillment");
      expect(asked).toBe(resolveStoreModules(category).has("delivery"));
    }
  });

  it("follows the store's OWN modules, not the sector defaults", () => {
    // A shop that switched location off is not asked for a region it will
    // never show — the same override the completeness rules already respect.
    const off = resolveStoreModules("retail", { location: false });
    expect(storeIntakeFields("retail", off)).not.toContain("region");
    expect(storeIntakeFields("retail", off)).not.toContain("area");
  });

  it("always ends on the description and never repeats a field", () => {
    for (const category of ALL_SECTORS) {
      const f = fieldsFor(category);
      expect(f[f.length - 1]).toBe("description");
      expect(new Set(f).size).toBe(f.length);
    }
  });

  it("stays short — no sector is asked more than four extra questions", () => {
    // The whole point is fewer questions than the eight the form used to ask.
    for (const category of ALL_SECTORS) {
      expect(fieldsFor(category).length).toBeLessThanOrEqual(4);
    }
  });
});

describe("publishStage", () => {
  it("calls an approved store live however thin it is", () => {
    expect(publishStage("active", false)).toBe("live");
    expect(publishStage("active", true)).toBe("live");
  });

  it("separates finished-and-waiting from still-working", () => {
    expect(publishStage("pending", true)).toBe("review");
    expect(publishStage("pending", false)).toBe("setup");
  });

  it("never describes a suspended or rejected store as nearly ready", () => {
    for (const status of ["suspended", "rejected"]) {
      expect(publishStage(status, true)).toBe("blocked");
      expect(publishStage(status, false)).toBe("blocked");
    }
  });
});

describe("isFirstRun", () => {
  const req = (done: boolean) => ({ required: true, done });
  const opt = (done: boolean) => ({ required: false, done });

  it("is true only while no publish blocker has been cleared", () => {
    expect(isFirstRun([req(false), req(false), opt(true)])).toBe(true);
    expect(isFirstRun([req(false), req(true), opt(false)])).toBe(false);
  });

  it("is false when there is nothing required to do at all", () => {
    expect(isFirstRun([opt(false), opt(false)])).toBe(false);
    expect(isFirstRun([])).toBe(false);
  });
});
