import { describe, it, expect } from "vitest";
import { categoryKeys } from "@/lib/catalog";
import { isDirectoryOnlySector } from "@/lib/store-experience";
import { resolveStoreModules } from "@/lib/sectors";
import {
  DEFAULT_OFFERING_SECTIONS,
  offeringSectionSlot,
  resolveOffering,
  type OfferingKind,
  type OfferingSectionKey,
} from "@/lib/offering";

const KINDS: OfferingKind[] = ["product", "service", "digital"];

// Same contract as the profile-order resolver, for the same reason: a
// hand-written per-variant section list is exactly what somebody edits in a
// hurry, and the failure it invites — an offering page quietly missing its
// reviews — is invisible until a merchant complains. Here it is made impossible
// by construction: anything a composition forgets is appended, and anything it
// genuinely does not want must be DECLARED, which shows up in these tests.
describe("offering sections", () => {
  it("accounts for every section, for every sector × kind", () => {
    for (const category of categoryKeys) {
      for (const itemKind of KINDS) {
        const { sections, omitted, variant } = resolveOffering({
          category,
          itemKind,
        });
        expect(
          [...sections, ...omitted].sort(),
          `${category}/${itemKind} (${variant}) loses a section`,
        ).toEqual([...DEFAULT_OFFERING_SECTIONS].sort());
      }
    }
  });

  it("never renders the same section twice, and never renders an omitted one", () => {
    for (const category of categoryKeys) {
      for (const itemKind of KINDS) {
        const { sections, omitted } = resolveOffering({ category, itemKind });
        expect(
          new Set(sections).size,
          `${category}/${itemKind} repeats a section`,
        ).toBe(sections.length);
        for (const key of omitted) {
          expect(
            sections.includes(key),
            `${category}/${itemKind} renders an omitted section`,
          ).toBe(false);
        }
      }
    }
  });

  it("appends a section a composition forgot instead of dropping it", () => {
    // Guards the mechanism itself: every variant's list is at least as long as
    // the default minus what it declared away, so a shortened composition can
    // only ever grow back, never silently shrink.
    for (const category of categoryKeys) {
      for (const itemKind of KINDS) {
        const { sections, omitted } = resolveOffering({ category, itemKind });
        expect(sections.length).toBe(
          DEFAULT_OFFERING_SECTIONS.length - omitted.length,
        );
      }
    }
  });

  it("always leads with the gallery, the name and the price", () => {
    for (const category of categoryKeys) {
      for (const itemKind of KINDS) {
        expect(
          resolveOffering({ category, itemKind }).sections.slice(0, 3),
        ).toEqual(["gallery", "header", "price"]);
      }
    }
  });

  it("puts the buy box above the social proof, never below it", () => {
    for (const category of categoryKeys) {
      for (const itemKind of KINDS) {
        const { sections } = resolveOffering({ category, itemKind });
        expect(sections.indexOf("buyBox")).toBeLessThan(
          sections.indexOf("reviews"),
        );
      }
    }
  });

  it("slots every section into a region of the page", () => {
    for (const key of DEFAULT_OFFERING_SECTIONS) {
      expect(["gallery", "detail", "page"]).toContain(
        offeringSectionSlot(key as OfferingSectionKey),
      );
    }
    expect(offeringSectionSlot("gallery")).toBe("gallery");
    expect(offeringSectionSlot("buyBox")).toBe("detail");
    expect(offeringSectionSlot("reviews")).toBe("page");
  });
});

describe("offering variant", () => {
  it("gives a service the appointment page in every booking sector", () => {
    for (const category of [
      "healthcare",
      "beauty",
      "services",
      "professional",
      "petCare",
      "sportsCourts",
    ] as const) {
      expect(resolveOffering({ category, itemKind: "service" }).variant).toBe(
        "appointmentService",
      );
    }
  });

  it("gives a food product the menu page and everything else the product page", () => {
    expect(resolveOffering({ category: "food", itemKind: "product" }).variant).toBe(
      "menuItem",
    );
    expect(
      resolveOffering({ category: "retail", itemKind: "product" }).variant,
    ).toBe("physicalProduct");
    expect(
      resolveOffering({ category: "pharmacy", itemKind: "digital" }).variant,
    ).toBe("physicalProduct");
  });

  it("lets the item kind beat the sector in both directions", () => {
    // A clinic that sells supplements sells a product — before item_kind was
    // read, enabling appointments turned every row into a bookable service and
    // the cart vanished. A vet's pet food is the live case: 3 rows in prod.
    expect(
      resolveOffering({ category: "healthcare", itemKind: "product" }).variant,
    ).toBe("physicalProduct");
    expect(
      resolveOffering({ category: "petCare", itemKind: "product" }).cta,
    ).toBe("addToCart");
    // …and a retailer that offers a service gets the appointment page.
    expect(
      resolveOffering({ category: "retail", itemKind: "service" }).variant,
    ).toBe("appointmentService");
  });

  it("never speaks product language on a service page", () => {
    const svc = resolveOffering({ category: "healthcare", itemKind: "service" });
    expect(svc.noun).toBe("service");
    expect(svc.relatedKind).toBe("service");
    // "stock" and "bought together" are retail concepts; a dental cleaning has
    // neither, and the page must not invent a shell for them.
    expect(svc.omitted).toContain("stock");
    expect(svc.omitted).toContain("boughtTogether");
    expect(svc.sections).toContain("duration");
    expect(svc.sections).toContain("provider");
  });

  it("speaks dish language on a menu item", () => {
    const dish = resolveOffering({ category: "food", itemKind: "product" });
    expect(dish.noun).toBe("dish");
    expect(dish.relatedKind).toBe("product");
    expect(dish.omitted).toContain("provider");
  });
});

describe("offering CTA", () => {
  it("is correct for each variant", () => {
    expect(resolveOffering({ category: "retail", itemKind: "product" }).cta).toBe(
      "addToCart",
    );
    expect(
      resolveOffering({ category: "healthcare", itemKind: "service" }).cta,
    ).toBe("bookAppointment");
    expect(resolveOffering({ category: "food", itemKind: "product" }).cta).toBe(
      "addToOrder",
    );
  });

  it("never offers a transaction a directory-only sector cannot honour", () => {
    for (const category of categoryKeys) {
      if (!isDirectoryOnlySector(category)) continue;
      for (const itemKind of KINDS) {
        const o = resolveOffering({ category, itemKind });
        expect(o.cta, `${category}/${itemKind} transacts`).toBe("contactStore");
        expect(o.transacts).toBe(false);
      }
    }
  });

  it("marks exactly the on-page transactions as transacting", () => {
    expect(
      resolveOffering({ category: "retail", itemKind: "product" }).transacts,
    ).toBe(true);
    expect(
      resolveOffering({ category: "food", itemKind: "product" }).transacts,
    ).toBe(true);
    // The service hands off to the existing booking engine — this page does not
    // transact, it routes.
    expect(
      resolveOffering({ category: "healthcare", itemKind: "service" }).transacts,
    ).toBe(false);
  });

  it("never promises a booking in a sector that has no booking engine", () => {
    // MJ-009's mechanism, and the reason a lab test ends up in a cart. The
    // item-kind toggle is deliberately shown in EVERY sector — a boutique doing
    // alterations, a phone shop doing repairs, a pharmacy that is really a lab
    // all need somewhere to put a service. But the storefront's calendar renders
    // only where the `appointments` module is on (`resolveStoreExperience`
    // derives showBooking from the module set), and the CTA did not check that:
    // a service row in a sector without the module got "احجز موعدًا" pointing at
    // /store/<id>?service=<id>, and the page it landed on had no calendar.
    //
    // Live case at the time of writing: the `services` sector carries `requests`
    // and not `appointments`, and one active production store there has a
    // service row whose product page showed the booking CTA.
    for (const category of categoryKeys) {
      if (isDirectoryOnlySector(category)) continue; // covered above
      const bookable = resolveStoreModules(category).has("appointments");
      const { cta, transacts } = resolveOffering({
        category,
        itemKind: "service",
      });
      expect(cta, `${category} service CTA`).toBe(
        bookable ? "bookAppointment" : "contactStore",
      );
      // Either way this page routes, it never sells: no cart, no quantity.
      expect(transacts, `${category} service transacts`).toBe(false);
    }
  });

  it("keeps the appointment PAGE even where it cannot offer the booking", () => {
    // The variant is about what a service IS — a duration, a person who
    // performs it, no stock count and no "usually bought with". That stays true
    // in a sector with no calendar; only the promise at the bottom changes.
    const svc = resolveOffering({ category: "services", itemKind: "service" });
    expect(svc.variant).toBe("appointmentService");
    expect(svc.noun).toBe("service");
    expect(svc.omitted).toContain("stock");
    expect(svc.cta).toBe("contactStore");
  });

  it("lets a caller that knows the store's real modules override the sector", () => {
    // The sector default is the right answer today because the modules screen
    // offers `sectorDefaultModules` and nothing else. When a store can enable
    // `appointments` outside its bundle, the caller passes the resolved set and
    // the CTA follows the store rather than the sector.
    expect(
      resolveOffering({
        category: "pharmacy",
        itemKind: "service",
        enabledModules: resolveStoreModules("pharmacy", { appointments: true }),
      }).cta,
    ).toBe("bookAppointment");
    expect(
      resolveOffering({
        category: "healthcare",
        itemKind: "service",
        enabledModules: resolveStoreModules("healthcare", { appointments: false }),
      }).cta,
    ).toBe("contactStore");
  });

  it("gives every sector × kind exactly one of the four CTAs", () => {
    for (const category of categoryKeys) {
      for (const itemKind of KINDS) {
        expect([
          "addToCart",
          "addToOrder",
          "bookAppointment",
          "contactStore",
        ]).toContain(resolveOffering({ category, itemKind }).cta);
      }
    }
  });
});
