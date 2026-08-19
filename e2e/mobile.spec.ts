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
