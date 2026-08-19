import type { APIRequestContext, Page } from "@playwright/test";

/**
 * Nothing in this suite hard-codes a store id. Store ids belong to live
 * merchants; one deactivating their shop should not turn a test red for a
 * reason that has nothing to do with the code under test. Instead we ask the
 * app's own discovery page which storefronts exist right now.
 */

const STORE_HREF = /href="\/ar\/store\/([0-9a-f-]{36})"/g;

/** Store ids currently linked from /ar/explore, optionally narrowed to a sector. */
export async function discoverStoreIds(
  request: APIRequestContext,
  sector?: string,
): Promise<string[]> {
  const url = sector
    ? `/ar/explore?${new URLSearchParams({ sector }).toString()}`
    : "/ar/explore";
  const response = await request.get(url);
  if (!response.ok()) {
    throw new Error(
      `Could not read ${url} to discover storefronts — it answered HTTP ${response.status()}. ` +
        `Every store test depends on /explore working, so fix that page first.`,
    );
  }
  const html = await response.text();
  const ids = new Set<string>();
  for (const match of html.matchAll(STORE_HREF)) ids.add(match[1]);
  return [...ids];
}

/**
 * A search URL with the query percent-encoded.
 *
 * This exists because a previous investigation nearly reported a false outage:
 * an Arabic term pasted raw into a URL came back with zero hits, and the
 * conclusion drawn was "search is down" rather than "the URL was never encoded".
 * Building the query string through URLSearchParams makes that impossible.
 */
export function arabicSearchUrl(query: string): string {
  return `/ar/search?${new URLSearchParams({ q: query }).toString()}`;
}

/**
 * The ids of the storefront sections the page actually rendered, in DOM order.
 *
 * `src/app/[lang]/(site)/store/[id]/page.tsx` wraps every section the sector
 * resolver placed in a `<div id="sec-{key}">`, so this is the resolver's output
 * as a customer receives it — not as a unit test imagines it.
 */
export async function renderedSectionKeys(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[id^="sec-"]')).map((el) =>
      el.id.replace(/^sec-/, ""),
    ),
  );
}
