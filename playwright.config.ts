import { defineConfig, devices } from "@playwright/test";

// ============================================================================
// Matjar end-to-end smoke suite
// ============================================================================
//
// THE DATA STORY — read this before adding a test.
//
// These tests run the real Next.js production build against the REAL, LIVE
// Supabase project (`wesihatopiznatsyfxer`, read from .env.local). That is
// production data. The suite is therefore **strictly read-only**:
//
//   * every test is a GET navigation, plus one login attempt with credentials
//     that are deliberately invalid;
//   * nothing signs in, nothing submits an order, review, booking or message;
//   * the two components that DO write on a plain page view — `TrackVisit`
//     (store_visits) and `TrackSearch` (search_logs) — both return early when
//     `navigator.webdriver` is true, which Playwright always sets. So a
//     Playwright page view records nothing. `e2e/store-profile.spec.ts` asserts
//     that guard is still in place, so the day someone removes it this suite
//     tells you instead of quietly starting to write to production.
//
// The trade-off, stated plainly: because the fixtures are live marketplace
// data, a merchant deactivating their store can change what these tests see.
// That is mitigated by never hard-coding a store id — `e2e/support/site.ts`
// discovers storefronts from /explore at run time — but it is not eliminated.
// A test that fails because the marketplace genuinely has no clinic with a
// doctor roster says so in its failure message, distinctly from a test that
// fails because the sector resolver broke.
//
// The alternative — a local `supabase start` seeded from supabase/migrations —
// is the better long-term answer and is NOT set up here: the Docker-backed
// local stack was not available in this environment, and pointing writes at a
// dedicated cloud test project would have meant provisioning one. Read-only
// against production is what could honestly be made to work today. NEVER point
// a write test at `wesihatopiznatsyfxer`.
//
// ----------------------------------------------------------------------------
// retries: 0 on purpose. A retry is a way to not notice a flaky test. If a test
// here is flaky, that is the bug.
// ----------------------------------------------------------------------------

const PORT = Number(process.env.E2E_PORT ?? 3111);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Keeps the vitest unit suite (src/**/*.test.ts) and this one strictly apart:
  // Playwright only ever looks in e2e/ and only at *.spec.ts.
  testMatch: /.*\.spec\.ts$/,

  fullyParallel: true,
  retries: 0,
  workers: 4,
  forbidOnly: !!process.env.CI,

  // 30s per test. Enough for a cold server-render that reads Supabase over the
  // network, not so much that a page which became slow still passes unnoticed.
  timeout: 30_000,
  expect: { timeout: 7_000 },

  reporter: process.env.CI
    ? [["list"], ["github"], ["html", { open: "never" }]]
    : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    locale: "ar-LB",
  },

  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile\.spec\.ts$/,
    },
    {
      // 375px is the width the horizontal-scroll defect keeps coming back at.
      // Chromium-based (Pixel 5) rather than WebKit so a run needs exactly one
      // browser download: `npx playwright install chromium`.
      name: "mobile-375",
      use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 } },
      testMatch: /mobile\.spec\.ts$/,
    },
  ],

  // One command runs everything: build, boot, test. `reuseExistingServer` is on
  // locally so an already-running `next start -p 3111` is reused instead of
  // paying the ~60s build again; CI always builds from scratch.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npm run start -- --port ${PORT}`,
        url: `${BASE_URL}/ar`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
