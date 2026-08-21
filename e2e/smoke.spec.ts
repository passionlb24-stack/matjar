import { expect, test } from "@playwright/test";
import { describeProblems, watchForProblems } from "./support/health";
import { arabicSearchUrl, discoverStoreIds } from "./support/site";

// Every string asserted below is the Arabic the app actually ships in
// src/i18n/dictionaries/ar.json. Asserting the Arabic — not a class name, not a
// test id — is the point: it is what a customer in Lebanon reads.
const AR = {
  heroTitle: "كل متجر ومطعم وخدمة في لبنان",
  loginTitle: "تسجيل الدخول",
  loginButton: "دخول",
  loginBadCredentials: "البريد أو كلمة المرور غير صحيحة.",
  searchResultsFor: "نتائج البحث عن",
  searchEmpty: "ما في نتائج مطابقة.",
  notFoundTitle: "الصفحة غير موجودة",
};

test("homepage renders in Arabic, right-to-left", async ({ page }) => {
  await page.goto("/ar");

  const html = page.locator("html");
  await expect(
    html,
    'The document must declare lang="ar" on /ar. If this fails, look at ' +
      "src/app/[lang]/layout.tsx — the locale is no longer reaching <html>.",
  ).toHaveAttribute("lang", "ar");

  await expect(
    html,
    'The document must declare dir="rtl" for Arabic. If this fails, Arabic ' +
      "text is rendering left-to-right for every visitor — check " +
      "localeDirection in src/i18n/config.ts and its use in [lang]/layout.tsx.",
  ).toHaveAttribute("dir", "rtl");

  await expect(
    page.getByRole("heading", { level: 1 }),
    `The homepage <h1> must be the Arabic hero line ("${AR.heroTitle}"). ` +
      "If this fails, either the dictionary key hero.title changed or the " +
      "homepage fell back to English — look at src/components/hero.tsx.",
  ).toContainText(AR.heroTitle);
});

test("explore lists real storefronts", async ({ request }) => {
  const ids = await discoverStoreIds(request);

  expect(
    ids.length,
    "/ar/explore linked to no /ar/store/<uuid> at all. Either the discovery " +
      "query in src/components/discovery-page.tsx stopped returning stores, or " +
      "the marketplace has no active store. Open /ar/explore and look.",
  ).toBeGreaterThan(0);
});

test("Arabic search finds a store by a word from its own Arabic name", async ({
  page,
  request,
}) => {
  // The query is taken from live data rather than hard-coded, so this test
  // stays true as the marketplace changes: whatever Arabic-named store is
  // listed today must be findable by a word from that name.
  const ids = await discoverStoreIds(request);
  let target: { id: string; name: string; word: string } | null = null;

  for (const id of ids) {
    const html = await (await request.get(`/ar/store/${id}`)).text();
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
    const name = title.replace(/\s*·\s*متجر\s*$/, "").trim();
    const word = (name.match(/[ء-ي]{3,}/g) ?? [])
      .sort((a, b) => b.length - a.length)[0];
    if (word) {
      target = { id, name, word };
      break;
    }
  }

  expect(
    target,
    "No listed store has an Arabic word of 3+ letters in its name, so there is " +
      "nothing to search for. This is a data situation, not a search bug — but " +
      "it means Arabic search is currently unverifiable.",
  ).not.toBeNull();
  const { id, name, word } = target!;

  const url = arabicSearchUrl(word);
  expect(
    url,
    "The Arabic query must be percent-encoded in the URL. A raw Arabic query " +
      "string is how a previous investigation nearly reported a false search " +
      "outage — see arabicSearchUrl() in e2e/support/site.ts.",
  ).toContain("q=%");

  await page.goto(url);

  await expect(
    page.getByRole("heading", { level: 1 }),
    `The results heading must echo the query "${word}" back in Arabic. If it ` +
      "does not, the query never survived the URL — check how searchParams.q " +
      "is read in src/app/[lang]/(site)/search/page.tsx.",
  ).toContainText(AR.searchResultsFor);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(word);

  await expect(
    page.locator(`a[href="/ar/store/${id}"]`).first(),
    `Searching "${word}" must return the store it was taken from ("${name}", ` +
      `/ar/store/${id}). If this fails, Arabic matching in ` +
      "src/lib/data/search.ts (searchAll) is broken — a store listed on " +
      "/explore cannot be found by its own name.",
  ).toBeVisible();
});

test("a search with no matches shows the Arabic empty state, not an error", async ({
  page,
}) => {
  // Deliberate nonsense: valid Arabic letters, no possible match. The failure
  // this guards against is a zero-result search rendering as a broken page —
  // which is how "search is down" gets reported when search is fine.
  await page.goto(arabicSearchUrl("ضظغثقصشزخ"));

  await expect(
    page.getByText(AR.searchEmpty),
    `A query with no matches must show the Arabic empty state ("${AR.searchEmpty}"). ` +
      "If this fails, /ar/search either crashed or silently rendered nothing — " +
      "check the total === 0 branch in src/app/[lang]/(site)/search/page.tsx.",
  ).toBeVisible();
});

test("login page renders its Arabic form", async ({ page }) => {
  await page.goto("/ar/login");

  await expect(
    page.getByRole("heading", { name: AR.loginTitle }),
    `The login page must show the Arabic heading "${AR.loginTitle}". If this ` +
      "fails, /ar/login is not rendering LoginForm — see " +
      "src/components/auth-forms.tsx.",
  ).toBeVisible();

  await expect(
    page.locator("#email"),
    "The login form must have an email field (#email). Without it nobody can " +
      "sign in — see LoginForm in src/components/auth-forms.tsx.",
  ).toBeVisible();
  await expect(
    page.locator("#password"),
    "The login form must have a password field (#password).",
  ).toBeVisible();
});

test("login rejects bad credentials with a visible Arabic error", async ({
  page,
}) => {
  // No real account and no secret is involved: the address is generated to not
  // exist, so this can never be a password guess against a real user. An
  // address can still be overridden from the environment (never the repo) if a
  // specific one is ever needed.
  const email =
    process.env.E2E_BAD_LOGIN_EMAIL ??
    `e2e-no-such-user-${Date.now()}@matjar-e2e.invalid`;

  await page.goto("/ar/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("definitely-not-a-real-password");
  await page.getByRole("button", { name: AR.loginButton }).click();

  // Scoped to the form: Next's router announcer is also role="alert" and lives
  // at the document root, so an unscoped alert lookup matches two things.
  const formAlert = page.locator("form").getByRole("alert");

  await expect(
    formAlert,
    "Rejected credentials must produce a visible error in an ARIA alert inside " +
      "the login form. If this fails, someone who mistypes their password gets " +
      "no feedback at all — check setError/role=\"alert\" in LoginForm " +
      "(src/components/auth-forms.tsx).",
  ).toBeVisible();

  await expect(
    formAlert,
    `The rejection must be the Arabic message "${AR.loginBadCredentials}" ` +
      "(dict.auth.errorInvalid), not an untranslated Supabase string.",
  ).toHaveText(AR.loginBadCredentials);

  await expect(
    page,
    "A rejected login must leave the visitor on /ar/login. Landing anywhere " +
      "else means the failed attempt was treated as a success.",
  ).toHaveURL(/\/ar\/login/);
});

// This was two tests, the second marked test.fail(), because a page beneath a
// loading.tsx had already streamed its 200 by the time notFound() ran. I judged
// the shared skeleton worth more than the status and left it.
//
// That judgement was wrong, and the marker is what surfaced it: the suite went
// red with "expected to fail, but passed" once 6086d58 removed
// (site)/loading.tsx. That change measured something I had not — with the
// boundary in place, /ar and /ar/merchants shipped *zero* characters inside
// <main>, so a crawler and a phone that never finished hydrating both saw an
// empty shell. The skeleton was not costing a status code, it was costing every
// public page's server-rendered content.
//
// Folded back into one test, which is what the marker's own note said to do on
// the day it started passing.
test("an unknown URL renders the Arabic 404 page, with a 404 status", async ({
  page,
}) => {
  const response = await page.goto("/ar/this-page-does-not-exist-e2e");

  await expect(
    page.getByRole("heading", { name: AR.notFoundTitle }),
    `A missing page must render the Arabic not-found copy ("${AR.notFoundTitle}") ` +
      "from src/app/[lang]/not-found.tsx.",
  ).toBeVisible();

  expect(
    response?.status(),
    "A missing page must answer HTTP 404, not 200. A soft 404 is the shape " +
      "Google indexes as real content, and uptime monitoring can never see a " +
      "miss. If this regresses, look for a loading.tsx reintroduced above the " +
      "route — that is what caused it the first time.",
  ).toBe(404);
});

test("no page in the smoke set logs an uncaught error or a failed request", async ({
  context,
  request,
}) => {
  const [storeId] = await discoverStoreIds(request);
  const paths = [
    "/ar",
    "/ar/explore",
    arabicSearchUrl("عطر"),
    "/ar/login",
    ...(storeId ? [`/ar/store/${storeId}`] : []),
  ];

  const failures: string[] = [];
  for (const path of paths) {
    // A fresh page per path so one page's listeners can never colour another's
    // verdict, and so nothing carries over in session storage.
    const page = await context.newPage();
    const collected = watchForProblems(page);
    await page.goto(path, { waitUntil: "load" });
    // Client islands (analytics, "for you", the map) fetch AFTER load, so a
    // fixed pause here would make this test's verdict depend on how busy the
    // machine is — the flakiest kind of test there is. Wait for the network to
    // actually go quiet instead; the catch is a safety net, not a shortcut.
    await page
      .waitForLoadState("networkidle", { timeout: 20_000 })
      .catch(() => {});
    const problems = collected();
    if (problems.length > 0) failures.push(describeProblems(path, problems));
    await page.close();
  }

  expect(
    failures.join("\n"),
    "One or more smoke pages logged an uncaught exception, a console error, a " +
      "failed request, or an HTTP 4xx/5xx. Each line below names the page and " +
      "the exact problem — open that page in a browser with devtools and you " +
      "will see the same thing.",
  ).toBe("");
});
