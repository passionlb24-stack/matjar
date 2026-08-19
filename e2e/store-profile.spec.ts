import { expect, test } from "@playwright/test";
import { discoverStoreIds, renderedSectionKeys } from "./support/site";

// The sector composition invariant, asserted for real.
//
// src/lib/sectors.ts decides what a storefront leads with per sector, and its
// unit tests assert that in the abstract — over arrays, in node, with no page
// involved. These two tests assert the same thing where it matters: in the HTML
// a customer receives. The store page wraps each rendered section in
// <div id="sec-{key}">, so DOM order IS resolveProfileOrder()'s output.

/** Walks a sector's storefronts and returns the first that rendered `section`. */
async function firstStoreShowing(
  request: Parameters<typeof discoverStoreIds>[0],
  browserPage: import("@playwright/test").Page,
  sector: string,
  section: string,
): Promise<{ id: string; keys: string[] } | null> {
  for (const id of await discoverStoreIds(request, sector)) {
    await browserPage.goto(`/ar/store/${id}`);
    const keys = await renderedSectionKeys(browserPage);
    if (keys.includes(section)) return { id, keys };
  }
  return null;
}

test("a retail storefront leads with its catalogue", async ({
  page,
  request,
}) => {
  const found = await firstStoreShowing(request, page, "retail", "catalog");

  expect(
    found,
    "No retail store on /ar/explore?sector=retail rendered a catalogue " +
      "section at all. That is a DATA situation (no listed shop has products), " +
      "not necessarily a resolver bug — but it also means the retail " +
      "composition is currently unverifiable against a real page.",
  ).not.toBeNull();
  const { id, keys } = found!;

  expect(
    keys[0],
    `A shop's page must LEAD with what it sells. On /ar/store/${id} the ` +
      `sections rendered in this order: ${keys.join(" > ")}. "catalog" must be ` +
      "first. If it is not, the retail entry in PROFILE_ORDER " +
      "(src/lib/sectors.ts) changed, or resolveProfileOrder() is no longer " +
      "driving the render order in src/app/[lang]/(site)/store/[id]/page.tsx — " +
      "which is exactly the defect that once buried the catalogue eighteenth.",
  ).toBe("catalog");
});

test("a clinic lists its doctors above its catalogue", async ({
  page,
  request,
}) => {
  const found = await firstStoreShowing(request, page, "healthcare", "doctors");

  expect(
    found,
    "No healthcare store on /ar/explore?sector=healthcare rendered a doctors " +
      "section. That is a DATA situation (no listed clinic has a doctor on its " +
      "roster), not necessarily a resolver bug — but the healthcare " +
      "composition is then unverifiable against a real page.",
  ).not.toBeNull();
  const { id, keys } = found!;

  const doctorsAt = keys.indexOf("doctors");
  const catalogAt = keys.indexOf("catalog");

  expect(
    catalogAt,
    `/ar/store/${id} rendered no catalogue, so there is nothing to order the ` +
      `doctors against. Sections were: ${keys.join(" > ")}.`,
  ).toBeGreaterThan(-1);

  expect(
    doctorsAt,
    `You choose a clinic by its doctors. On /ar/store/${id} the sections ` +
      `rendered in this order: ${keys.join(" > ")}. "doctors" (index ` +
      `${doctorsAt}) must come before "catalog" (index ${catalogAt}). If it ` +
      "does not, the healthcare entry in PROFILE_ORDER (src/lib/sectors.ts) " +
      "regressed to the default order, which put the roster below the product " +
      "grid.",
  ).toBeLessThan(catalogAt);
});

test("a storefront view records nothing in production", async ({
  page,
  request,
}) => {
  // The whole read-only story of this suite rests on one fact: TrackVisit and
  // TrackSearch both bail out when navigator.webdriver is true. If either that
  // browser flag or that guard ever goes away, this suite silently starts
  // writing rows to the live store_visits / search_logs tables. This test is
  // the tripwire.
  const [storeId] = await discoverStoreIds(request);
  expect(storeId, "Need at least one storefront to check the write guard.")
    .toBeTruthy();

  await page.goto(`/ar/store/${storeId}`);

  expect(
    await page.evaluate(() => navigator.webdriver),
    "navigator.webdriver is no longer true under Playwright. TrackVisit " +
      "(src/components/track-visit.tsx) and TrackSearch " +
      "(src/components/track-search.tsx) skip their writes on exactly that " +
      "flag, so this suite would now be writing analytics rows into the " +
      "PRODUCTION Supabase project on every run. Stop and fix this before " +
      "running the suite again.",
  ).toBe(true);
});
