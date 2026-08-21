import { describe, expect, it } from "vitest";
import { LEGAL_ENV_KEYS, readLegalEntity } from "@/lib/legal-entity";

// The failure this guards against is not a crash. It is a public page confidently
// printing "Matjar SARL, Commercial Register 12345" under a heading that says who
// operates this platform, when nobody ever supplied either fact. Every assertion
// below is about refusing to be plausible.

const REAL = {
  MATJAR_LEGAL_NAME: "Some Real Entity SARL",
  MATJAR_LEGAL_REGISTRATION: "Tripoli Commercial Register 12345",
  MATJAR_LEGAL_ADDRESS: "Some street, Tripoli, Lebanon",
  MATJAR_LEGAL_EMAIL: "legal@example.com",
};

describe("readLegalEntity", () => {
  it("reports an empty environment as unconfigured, naming every variable", () => {
    const state = readLegalEntity({});
    expect(state.configured).toBe(false);
    if (state.configured) return;
    expect(state.missing).toEqual([...LEGAL_ENV_KEYS]);
    expect(state.placeholders).toEqual([]);
  });

  it("accepts a fully configured environment", () => {
    const state = readLegalEntity(REAL);
    expect(state.configured).toBe(true);
    if (!state.configured) return;
    expect(state.fields.MATJAR_LEGAL_NAME).toBe("Some Real Entity SARL");
    expect(state.vat).toBeNull();
  });

  it("treats whitespace as unset rather than as a value", () => {
    const state = readLegalEntity({ ...REAL, MATJAR_LEGAL_ADDRESS: "   " });
    expect(state.configured).toBe(false);
    if (state.configured) return;
    expect(state.missing).toEqual(["MATJAR_LEGAL_ADDRESS"]);
  });

  it("refuses filler a half-finished deployment would really contain", () => {
    for (const filler of ["TODO", "tbd", "N/A", "changeme", "  Placeholder "]) {
      const state = readLegalEntity({ ...REAL, MATJAR_LEGAL_NAME: filler });
      expect(state.configured).toBe(false);
      if (state.configured) continue;
      expect(state.placeholders).toEqual(["MATJAR_LEGAL_NAME"]);
      // Named as a placeholder, not as missing: "you left it empty" and "you
      // typed TODO into it" need different words to the person fixing it.
      expect(state.missing).toEqual([]);
    }
  });

  it("refuses a notice address that could not receive a notice", () => {
    const state = readLegalEntity({
      ...REAL,
      MATJAR_LEGAL_EMAIL: "legal at example dot com",
    });
    expect(state.configured).toBe(false);
    if (state.configured) return;
    expect(state.placeholders).toEqual(["MATJAR_LEGAL_EMAIL"]);
  });

  it("keeps a VAT number when there is one and stays silent when there is not", () => {
    const withVat = readLegalEntity({ ...REAL, MATJAR_LEGAL_VAT: "LB-123456" });
    expect(withVat.configured && withVat.vat).toBe("LB-123456");

    // Not being VAT-registered is a legitimate answer, so an absent or blank
    // value must not block the whole page the way a missing name does.
    for (const vat of [undefined, "", "  ", "n/a"]) {
      const state = readLegalEntity({ ...REAL, MATJAR_LEGAL_VAT: vat });
      expect(state.configured).toBe(true);
      expect(state.configured && state.vat).toBeNull();
    }
  });
});
