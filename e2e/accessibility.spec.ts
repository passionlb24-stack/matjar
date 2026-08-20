import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Result } from "axe-core";
import { arabicSearchUrl, discoverStoreIds } from "./support/site";

// ============================================================================
// Accessibility, asserted on the pages the smoke suite already visits.
// ============================================================================
//
// READ-ONLY, like the rest of this suite. axe runs entirely inside the page: it
// walks the rendered DOM and computes contrast and name/role/value. It clicks
// nothing, submits nothing, and touches no Supabase table. So none of the
// production-write reasoning in playwright.config.ts applies here, and these
// tests run unconditionally.
//
// ---------------------------------------------------------------------------
// WHY THE TAG SET IS WHAT IT IS
// ---------------------------------------------------------------------------
// wcag2a, wcag2aa, wcag21a, wcag21aa — the legally-meaningful bar, and the one
// this codebase already reasons in: `fieldClass` in src/components/ui/field.tsx
// cites WCAG 1.4.11 by number for its border colour.
//
// `best-practice` is deliberately EXCLUDED. It contains rules like
// "region" (every bit of content inside a landmark) and "heading-order" which
// are real advice but not conformance failures, and mixing them in means a
// genuine 4.5:1 contrast failure arrives in a list of forty items and gets
// scrolled past. There is a second, non-failing test at the bottom that reports
// the best-practice findings so they are visible without being load-bearing.
//
// ---------------------------------------------------------------------------
// WHY THIS DOES NOT ASSERT "ZERO VIOLATIONS" WITH A BARE toEqual([])
// ---------------------------------------------------------------------------
// Because `[]` is not a useful failure message. When this breaks at 2am the
// person reading it needs the rule id, the CSS selector, the element's own
// HTML, and the fix — not "expected 3 to be 0". `describeViolations` prints all
// of that, and the assertion is made on the STRING so Playwright shows it.
// ---------------------------------------------------------------------------

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Renders axe's output as something a human can act on. */
function describeViolations(where: string, violations: Result[]): string {
  if (violations.length === 0) return "";
  const blocks = violations.map((v) => {
    const nodes = v.nodes
      .slice(0, 5)
      .map((n) => {
        const target = n.target.join(" ");
        const html = n.html.replace(/\s+/g, " ").slice(0, 200);
        // `failureSummary` is axe's own plain-English "Fix any of the
        // following" text. It is the single most useful line in the report and
        // is routinely thrown away by wrappers that only print rule ids.
        const summary = (n.failureSummary ?? "")
          .split("\n")
          .map((l) => `          ${l.trim()}`)
          .join("\n");
        return `      at: ${target}\n      html: ${html}\n${summary}`;
      })
      .join("\n\n");
    const more =
      v.nodes.length > 5 ? `\n      … and ${v.nodes.length - 5} more element(s)` : "";
    return (
      `  [${v.impact ?? "unknown"}] ${v.id} — ${v.help}\n` +
      `    ${v.helpUrl}\n` +
      `    ${v.nodes.length} element(s):\n${nodes}${more}`
    );
  });
  return `${where} has ${violations.length} accessibility violation(s):\n${blocks.join("\n\n")}`;
}

async function auditPath(
  page: import("@playwright/test").Page,
  path: string,
  tags: string[] = WCAG_TAGS,
): Promise<Result[]> {
  await page.goto(path, { waitUntil: "load" });
  // Client islands (the map, "for you", analytics) mount after load and can add
  // controls. A fixed pause would make the verdict depend on machine load — the
  // flakiest kind of test — so wait for the network to go quiet, with the catch
  // as a safety net rather than a shortcut. Same pattern as smoke.spec.ts.
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
  return violations;
}

// The pages the smoke suite already covers, plus the two forms — because a form
// is where an accessibility defect actually costs somebody something.
const CORE_PATHS = [
  { name: "homepage", path: "/ar" },
  { name: "explore", path: "/ar/explore" },
  { name: "search results", path: arabicSearchUrl("عطر") },
  { name: "login", path: "/ar/login" },
  { name: "signup", path: "/ar/signup" },
];

for (const { name, path } of CORE_PATHS) {
  test(`${name} (${path}) has no WCAG A/AA violations`, async ({ page }) => {
    const violations = await auditPath(page, path);
    expect(
      describeViolations(path, violations),
      `axe found WCAG 2.1 A/AA failures on ${path}. Each block below names the rule, ` +
        `links its explanation, and gives the exact element. These are conformance ` +
        `failures, not style opinions — an Arabic-speaking customer using a screen ` +
        `reader hits every one of them.`,
    ).toBe("");
  });
}

test("a real storefront has no WCAG A/AA violations", async ({
  page,
  request,
}) => {
  // Discovered at run time rather than hard-coded, for the same reason the rest
  // of the suite does it: a merchant deactivating their shop must not turn this
  // red for a reason unrelated to accessibility.
  const [storeId] = await discoverStoreIds(request);
  expect(
    storeId,
    "/ar/explore linked to no storefront, so there is no store page to audit. " +
      "That is the same data situation smoke.spec.ts reports — fix /explore first.",
  ).toBeTruthy();

  const violations = await auditPath(page, `/ar/store/${storeId}`);
  expect(
    describeViolations(`/ar/store/${storeId}`, violations),
    "axe found WCAG 2.1 A/AA failures on a live storefront. This is the page a " +
      "customer actually buys from.",
  ).toBe("");
});

test("the RTL document survives an automated check of its language and direction", async ({
  page,
}) => {
  // html-has-lang / html-lang-valid / valid-lang are in the tag set above, but
  // they are worth naming separately: `dir="rtl"` with a wrong or missing `lang`
  // is the specific failure that makes a screen reader read Arabic with an
  // English voice, which is unintelligible rather than merely wrong.
  const violations = await auditPath(page, "/ar");
  const languageRules = violations.filter((v) => v.id.includes("lang"));
  expect(
    describeViolations("/ar (language rules)", languageRules),
    "The Arabic document failed one of axe's language rules. A screen reader " +
      "picks its voice from <html lang>; getting it wrong means Arabic read " +
      "aloud by an English synthesiser.",
  ).toBe("");
});

// ---------------------------------------------------------------------------
// Reporting-only. Never fails.
//
// best-practice findings are real advice that is NOT a WCAG conformance
// failure. They belong in the run's output where somebody can see them and
// decide, not in the pass/fail signal where they would dilute it. If this list
// ever gets short enough to be worth enforcing, promote the rules you want into
// WCAG_TAGS above — do not simply flip this test to assert zero.
// ---------------------------------------------------------------------------
test("best-practice accessibility findings (reported, not enforced)", async ({
  page,
}) => {
  // Five pages, each with a networkidle wait, in ONE test — comfortably past the
  // suite-wide 30s. Raised here rather than globally: the other tests SHOULD
  // fail if a single page takes 30 seconds.
  test.setTimeout(120_000);
  const lines: string[] = [];
  for (const { path } of CORE_PATHS) {
    const violations = await auditPath(page, path, ["best-practice"]);
    if (violations.length > 0) {
      lines.push(
        `${path}: ${violations
          .map((v) => `${v.id}×${v.nodes.length}`)
          .join(", ")}`,
      );
    }
  }
  console.log(
    lines.length === 0
      ? "best-practice: nothing reported on the core paths."
      : `best-practice findings (NOT failures):\n  ${lines.join("\n  ")}`,
  );
  // Deliberately no assertion. See the block comment above.
});
