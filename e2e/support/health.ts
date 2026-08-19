import type { Page } from "@playwright/test";

/** One thing that went wrong while a page was loading. */
export type PageProblem = {
  kind: "uncaught-exception" | "console-error" | "request-failed" | "http-error";
  detail: string;
};

/**
 * Two exclusions, both verified against production rather than assumed:
 *
 *  1. `/_vercel/insights/script.js` — Vercel's edge serves this file only on a
 *     Vercel deployment. It returns 200 application/javascript on
 *     https://matjarlb.com and 404 on a local `next start`, because nothing in
 *     this repo serves that path. It is an artifact of running the build
 *     locally, not a defect in the app.
 *
 *  2. `?_rsc=…` requests that fail with net::ERR_ABORTED — these are Next's
 *     App Router link prefetches, cancelled by the browser when the test stops
 *     driving the page. A cancelled prefetch is the browser's decision, not a
 *     server failure. An _rsc request that fails for any OTHER reason, or that
 *     returns a 4xx/5xx, is still reported.
 */
function isKnownLocalHarnessNoise(url: string, errorText?: string): boolean {
  if (url.includes("/_vercel/insights/")) return true;
  if (url.includes("_rsc=") && errorText === "net::ERR_ABORTED") return true;
  return false;
}

/**
 * Starts recording everything that a human would call "the page is broken":
 * uncaught JS exceptions, console errors, network-level request failures, and
 * any HTTP response of 400 or worse.
 *
 * Returns a getter — call it after the page has settled.
 */
export function watchForProblems(page: Page): () => PageProblem[] {
  const problems: PageProblem[] = [];

  page.on("pageerror", (error) => {
    problems.push({
      kind: "uncaught-exception",
      detail: `${error.name}: ${error.message}`,
    });
  });

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // A console error whose whole content is the browser reporting one of the
    // excluded requests carries no extra information.
    if (isKnownLocalHarnessNoise(message.location().url ?? "")) return;
    if (text.includes("/_vercel/insights/")) return;
    problems.push({ kind: "console-error", detail: text });
  });

  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "unknown";
    if (isKnownLocalHarnessNoise(request.url(), errorText)) return;
    problems.push({
      kind: "request-failed",
      detail: `${request.method()} ${request.url()} — ${errorText}`,
    });
  });

  page.on("response", (response) => {
    if (response.status() < 400) return;
    if (isKnownLocalHarnessNoise(response.url())) return;
    problems.push({
      kind: "http-error",
      detail: `HTTP ${response.status()} — ${response.request().resourceType()} ${response.url()}`,
    });
  });

  return () => problems.slice();
}

/** Renders problems as something a human can act on at 2am. */
export function describeProblems(where: string, problems: PageProblem[]): string {
  if (problems.length === 0) return `${where}: clean`;
  const lines = problems.map((p) => `    [${p.kind}] ${p.detail}`);
  return `${where} produced ${problems.length} problem(s):\n${lines.join("\n")}`;
}
