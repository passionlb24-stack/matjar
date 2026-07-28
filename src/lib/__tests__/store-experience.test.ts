import { describe, it, expect } from "vitest";
import {
  resolveStoreExperience,
  isDirectoryOnlySector,
  isOrderSurface,
  leadKinds,
} from "../store-experience";
import { sectorDefaultModules } from "../sectors";
import type { CategoryKey } from "../catalog";
import type { FeatureModuleKey } from "../modules-catalog";

// Resolve using a sector's own default module bundle (what a fresh store gets).
function resolveDefault(category: CategoryKey) {
  const enabledModules = new Set<FeatureModuleKey>(
    sectorDefaultModules(category),
  );
  return resolveStoreExperience({ category, enabledModules });
}

describe("resolveStoreExperience", () => {
  it("commerce sectors get the order surface", () => {
    for (const c of ["retail", "food", "pharmacy", "farm"] as CategoryKey[]) {
      const x = resolveDefault(c);
      expect(x.status).toBe("active");
      expect(x.itemSurface).toBe("order");
      expect(x.showBooking).toBe(false);
      expect(x.directoryOnly).toBe(false);
    }
  });

  it("appointment sectors surface the booking engine (fixes the drift)", () => {
    // These declare the `appointments` module but were previously excluded from
    // the hardcoded {services, healthcare, realEstate} gate.
    for (const c of [
      "healthcare",
      "beauty",
      "petCare",
      "professional",
    ] as CategoryKey[]) {
      const x = resolveDefault(c);
      expect(x.status).toBe("active");
      expect(x.showBooking).toBe(true);
      expect(x.itemSurface).toBe("appointment");
    }
  });

  it("request sectors surface the service-request form", () => {
    // These declare the `requests` module. contractors + professional
    // previously got NO public form (hardcoded to services/healthcare) — fixed.
    for (const c of [
      "services",
      "professional",
      "contractors",
    ] as CategoryKey[]) {
      expect(resolveDefault(c).showServiceRequest).toBe(true);
    }
    // healthcare declares `appointments`, not `requests` → it gets the
    // appointment engine, not the generic request form (was drift before).
    expect(resolveDefault("healthcare").showServiceRequest).toBe(false);
    expect(resolveDefault("healthcare").showBooking).toBe(true);
  });

  it("hospitality uses the stay engine, not directory-only or hourly", () => {
    const x = resolveDefault("hospitality");
    expect(x.showStay).toBe(true);
    expect(x.directoryOnly).toBe(false);
    expect(x.allowResourceBooking).toBe(false); // no hourly room booking
    expect(x.showBooking).toBe(false);
    expect(isDirectoryOnlySector("hospitality")).toBe(false);
    // other sectors don't show stay
    expect(resolveDefault("retail").showStay).toBe(false);
    expect(resolveDefault("realEstate").showStay).toBe(false);
  });

  it("directory-only sectors never expose a wrong transaction", () => {
    for (const c of [
      "realEstate",
      "automotive",
      "events",
    ] as CategoryKey[]) {
      const x = resolveDefault(c);
      expect(x.status).toBe("directory_only");
      expect(x.directoryOnly).toBe(true);
      expect(x.itemSurface).toBe("catalog");
      expect(x.showBooking).toBe(false); // no clinic-style property booking
      expect(x.allowResourceBooking).toBe(false); // no hourly hotel/event booking
    }
    expect(isDirectoryOnlySector("realEstate")).toBe(true);
    expect(isDirectoryOnlySector("retail")).toBe(false);
  });

  it("lead sectors surface the lead form with the right kinds", () => {
    for (const c of ["realEstate", "automotive"] as CategoryKey[]) {
      expect(resolveDefault(c).showLeadForm).toBe(true);
    }
    // non-lead sectors never show it
    for (const c of ["retail", "healthcare", "hospitality", "food"] as CategoryKey[]) {
      expect(resolveDefault(c).showLeadForm).toBe(false);
    }
    expect(leadKinds("realEstate")).toContain("viewing");
    expect(leadKinds("automotive")).toContain("test_drive");
    expect(leadKinds("retail")).toEqual(["contact"]);
  });

  it("automotive keeps an interim lead channel via its requests module", () => {
    // automotive is directory-only but declares `requests` → surface it as a
    // lead capture instead of losing the inquiry to WhatsApp.
    expect(resolveDefault("automotive").showServiceRequest).toBe(true);
    // ...but the cart/order surface is gone.
    expect(isOrderSurface("automotive")).toBe(false);
  });

  it("sportsCourts stays active so hourly court booking still works", () => {
    const x = resolveDefault("sportsCourts");
    expect(x.status).toBe("active");
    expect(x.allowResourceBooking).toBe(true);
  });

  it("isOrderSurface is true only for non-directory commerce sectors", () => {
    expect(isOrderSurface("retail")).toBe(true);
    expect(isOrderSurface("food")).toBe(true);
    expect(isOrderSurface("automotive")).toBe(false); // directory-only
    expect(isOrderSurface("healthcare")).toBe(false); // booking kind
  });

  it("disabling the appointments module drops the booking surface", () => {
    const x = resolveStoreExperience({
      category: "beauty",
      enabledModules: new Set<FeatureModuleKey>(["catalog", "reviews"]),
    });
    expect(x.showBooking).toBe(false);
  });
});
