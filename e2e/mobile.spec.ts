import { expect, test } from "@playwright/test";
import { arabicSearchUrl, discoverStoreIds } from "./support/site";

// Runs only in the `mobile-375` project (see playwright.config.ts).
//
// Horizontal scroll at 375px is a recurring defect here, and it is invisible on
// a desktop viewport: one over-wide element — a table, a chip row, a fixed
// width, a negative RTL margin — makes the whole page slide sideways under the
// thumb. The check is exact: documentElement.scrollWidth must not exceed
// clientWidth.

test("no page scrolls horizontally at 375px", async ({ page, request }) => {
  const [storeId] = await discoverStoreIds(request);
  const paths = [
    "/ar",
    "/ar/explore",
    arabicSearchUrl("عطر"),
    "/ar/login",
    // The crafts section, because this is where the defect last came back and
    // where it will come back again. The trade-group cards are grid items, and
    // a grid item's automatic minimum size is its MIN-CONTENT width — so a
    // `truncate` (white-space: nowrap) line inside one floors the column at the
    // full untruncated Arabic string. That shipped 103px of horizontal scroll
    // at 360 and none at all at 768, where `sm:grid-cols-2` compiles to
    // minmax(0,1fr) and its explicit 0 minimum hides the whole thing. No
    // desktop check would ever have caught it.
    "/ar/crafts",
    "/ar/crafts/electrician",
    "/ar/crafts/requests",
    "/ar/crafts/join",
    // The freelance section, now that it is person-first: a people grid, a
    // services grid, a profile whose service-cover strip is `grid-cols-3`, and
    // a brief form whose recipient rows are full-width flex. Every one of those
    // is the same grid-item shape the crafts defect came out of. The ids are
    // the real production rows — the platform's only freelancer and one of his
    // three gigs — so a run that stops seeing them says the fixture moved,
    // which is worth knowing too.
    "/ar/freelance",
    "/ar/freelance?view=services",
    "/ar/freelance/pro/8b6f9cdc-3100-4f4b-a2df-3cb3e7c1e80a",
    "/ar/freelance/138fb16e-1282-4491-a547-9ed486b4acc4",
    "/ar/freelance/brief",
    ...(storeId ? [`/ar/store/${storeId}`] : []),
  ];

  const offenders: string[] = [];

  for (const path of paths) {
    await page.goto(path, { waitUntil: "load" });
    // Client islands can widen the page after first paint.
    await page.waitForTimeout(1_000);

    const result = await page.evaluate(() => {
      const de = document.documentElement;
      const culprits: string[] = [];
      if (de.scrollWidth > de.clientWidth) {
        for (const el of Array.from(document.querySelectorAll("*"))) {
          const box = el.getBoundingClientRect();
          if (box.width === 0) continue;
          // In RTL, overflow escapes to the left; in LTR, to the right.
          if (box.right > de.clientWidth + 1 || box.left < -1) {
            const cls =
              typeof el.className === "string" ? el.className.slice(0, 80) : "";
            culprits.push(
              `<${el.tagName.toLowerCase()} class="${cls}"> left=${Math.round(box.left)} right=${Math.round(box.right)}`,
            );
          }
          if (culprits.length >= 5) break;
        }
      }
      return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, culprits };
    });

    if (result.scrollWidth > result.clientWidth) {
      offenders.push(
        `${path} — scrollWidth ${result.scrollWidth} > clientWidth ${result.clientWidth} ` +
          `(overflowing by ${result.scrollWidth - result.clientWidth}px). ` +
          `Widest elements found:\n      ${result.culprits.join("\n      ")}`,
      );
    }
  }

  expect(
    offenders.join("\n  "),
    "At a 375px viewport the page must not scroll sideways. Each line names " +
      "the URL, how many pixels it overflows by, and the first elements that " +
      "stick out past the viewport — open that URL at 375px and inspect those " +
      "elements.",
  ).toBe("");
});
