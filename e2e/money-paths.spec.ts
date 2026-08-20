import { expect, test } from "@playwright/test";
import { discoverStoreIds } from "./support/site";

// ============================================================================
// The money paths: placing an order, placing a booking, and /activity.
//
// THESE TESTS DO NOT RUN. Read why before you try to switch them on.
// ============================================================================
//
// ---------------------------------------------------------------------------
// THE QUESTION
// ---------------------------------------------------------------------------
// Placing an order, placing a booking and opening /activity are the paths where
// a bug costs a real merchant a real sale, and none of them is covered. The rest
// of this suite is thirteen read-only navigations, safe because the only two
// components that write on a page view (`TrackVisit`, `TrackSearch`) bail out on
// `navigator.webdriver`.
//
// That safety does NOT extend here. Nothing in the checkout or booking code
// consults `navigator.webdriver` — the guard exists in exactly two files,
// src/components/track-visit.tsx:42 and src/components/track-search.tsx:38, and
// both are analytics. A Playwright test that clicks "أكّد الطلب" places a real
// order in the live `wesihatopiznatsyfxer` project.
//
// ---------------------------------------------------------------------------
// WHAT WAS ACTUALLY TRIED, AND WHY EACH OPTION FAILED
// ---------------------------------------------------------------------------
//
// 1. A LOCAL SUPABASE (`supabase start`), seeded from supabase/migrations.
//    This is the right answer and it is still the right answer. It is not
//    available: `supabase start` is Docker-backed and there is no Docker in this
//    environment (`docker --version` → command not found). Not a judgement call,
//    just a fact about the machine. The Supabase CLI itself installs fine, which
//    makes this the cheapest thing to fix the day a Docker host exists.
//
// 2. A SEEDED TEST STORE, FILTERED FROM PUBLIC LISTINGS.
//    This is the option that looks workable and is not, and the reason is worth
//    writing down because it is not obvious until you go looking:
//
//      * a store page is readable by anon only when `stores.status = 'active'
//        and deleted_at is null` (RLS `stores_select`, most recently restated in
//        0292);
//      * `place_guest_order` refuses with `store_unavailable` unless the store
//        is `status = 'active' and deleted_at is null`
//        (0194_food_modifiers.sql:263-264);
//      * a store is hidden from /explore only when it is NOT `status='active'`
//        (src/lib/data/discovery.ts:298).
//
//    The SAME column decides "can be ordered from" and "is publicly listed", so
//    it cannot separate them. A store you can check out from is a store real
//    customers can find. There is no `is_test`, `is_demo`, `hidden`, `unlisted`
//    or `internal_only` column on `stores` — I grepped the whole schema for all
//    of them. Making this work needs a NEW column threaded through roughly eight
//    query sites plus src/app/sitemap.ts plus `get_best_sellers`, which is a
//    schema change and a product decision, not a test fixture.
//
// 3. CLEANUP IN afterEach THAT PROVABLY RUNS.
//    This is the option I most wanted, and it is the one that fails hardest —
//    not on "does the hook run" but on "is the damage the kind that deleting a
//    row undoes". It is not:
//
//      * Inserting into `orders` fires `push_on_notification`, which makes a
//        pg_net HTTP POST to /api/push/hook and web-pushes the store owner
//        (0049_push_on_events.sql:4-42). A REAL MERCHANT'S PHONE RINGS. No
//        afterEach un-rings a phone. That single fact ends the argument.
//      * `place_stay_booking` writes `stay_bookings`, which carries an overlap
//        EXCLUSION constraint (0196:165-167). A test booking BLOCKS REAL
//        INVENTORY DATES for that unit until it is deleted — a merchant loses a
//        real booking in the window between insert and cleanup.
//      * Orders left in `pending` count toward `get_best_sellers`, which ranks
//        the public /ar/best-sellers page over the last 90 days
//        (0218:33-51). 0218's own header names this exact attack: "the cheapest
//        way onto it was a self-placed guest order for quantity 999."
//      * An order also decrements `products.stock`, and writes `customers`,
//        `order_status_history`, `automation_runs` and `checkout_intents` by
//        trigger — a cleanup would have to know all of them and stay correct as
//        triggers are added.
//
//    And the deletes themselves are impossible from here anyway: RLS gives the
//    anon role no DELETE on `orders`, so cleanup would need the service-role
//    key. Handling that key is forbidden, and rightly — a suite that needs a
//    god-mode credential to undo its own damage is a suite that has already
//    lost the argument.
//
// 4. A SECOND, DEDICATED CLOUD SUPABASE PROJECT. Not provisioned, and
//    provisioning one is not mine to do. This is the second-cheapest fix.
//
// ---------------------------------------------------------------------------
// THE DECISION
// ---------------------------------------------------------------------------
// Written, and skipped. Pointing a write at production to get a green tick
// would be trading a real merchant's Tuesday for a number on a dashboard.
//
// The tests below are NOT decoration. They are gated on an interlock (see
// `writesAreSafe`) that is skipped by default AND cannot be talked into running
// against `wesihatopiznatsyfxer` even if someone sets the opt-in variable — in
// that case it throws rather than skipping, because a silent skip is how a
// safety property quietly stops holding. `interlock.spec` below tests the
// interlock itself and DOES run, every time.
//
// TO ENABLE, the day option 1 or 4 exists:
//   NEXT_PUBLIC_SUPABASE_URL=<the non-production project>  E2E_ALLOW_WRITES=1
//
// HONESTY NOTE, because it matters more than the code below: these three tests
// have NEVER EXECUTED. They are written from the source — the selectors come
// from src/components/store-products.tsx (#name, #phone, #address) and the
// Arabic from src/i18n/dictionaries/ar.json — but nothing has confirmed the
// flow end to end. Expect to fix them on their first real run. Do not read a
// skipped test as a passing one.
// ---------------------------------------------------------------------------

/** The live marketplace. Nothing in this file may ever write to it. */
const PRODUCTION_PROJECT_REF = "wesihatopiznatsyfxer";

const AR = {
  checkout: "أكّد الطلب",
  confirmOrder: "تأكيد الطلب",
  name: "الاسم",
  phone: "رقم الهاتف",
  address: "العنوان",
  pickup: "استلام من المتجر",
  activityTitle: "طلباتي",
};

/**
 * The interlock.
 *
 * Two conditions, and BOTH are required:
 *   - `E2E_ALLOW_WRITES=1` must be set, deliberately, per run; and
 *   - the configured Supabase project must not be the production one.
 *
 * The asymmetry is the point. A missing opt-in SKIPS — that is the normal,
 * quiet, everyday state. An opt-in that points at production THROWS — because
 * that is somebody actively trying to do the forbidden thing, possibly by
 * copying an env var they did not read, and the loudest possible failure is the
 * kindest response.
 */
export function writesAreSafe(): { safe: boolean; why: string } {
  const target = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const optedIn = process.env.E2E_ALLOW_WRITES === "1";
  const isProduction = target.includes(PRODUCTION_PROJECT_REF);

  if (optedIn && isProduction) {
    throw new Error(
      "E2E_ALLOW_WRITES=1 was set while NEXT_PUBLIC_SUPABASE_URL still points at the " +
        `PRODUCTION Supabase project (${PRODUCTION_PROJECT_REF}). Refusing to run write tests.\n` +
        "A test order here inserts into `orders`, which web-pushes the store owner's phone " +
        "(0049_push_on_events.sql) and ranks the product on the public best-sellers page " +
        "(0218). None of that is undone by deleting a row.\n" +
        "Point NEXT_PUBLIC_SUPABASE_URL at a local or dedicated test project first.",
    );
  }
  if (!optedIn) {
    return {
      safe: false,
      why:
        "E2E_ALLOW_WRITES is not set. These tests write (orders, bookings) and there is " +
        "no non-production Supabase project configured — see the block comment at the top " +
        "of e2e/money-paths.spec.ts for the four options that were tried.",
    };
  }
  return { safe: true, why: "" };
}

// ---------------------------------------------------------------------------
// This one ALWAYS runs. The interlock is the only thing standing between this
// file and a write to production, so it is the one thing here that must be
// tested rather than trusted.
// ---------------------------------------------------------------------------
test("the write interlock refuses to run against production", async () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalOptIn = process.env.E2E_ALLOW_WRITES;
  try {
    // (a) opted in, pointed at production → must THROW, not skip.
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;
    process.env.E2E_ALLOW_WRITES = "1";
    expect(
      () => writesAreSafe(),
      "With E2E_ALLOW_WRITES=1 and the production project configured, the interlock MUST " +
        "throw. If this assertion fails, the guard has been weakened and the money-path " +
        "tests could write real orders to a real marketplace.",
    ).toThrow(/PRODUCTION Supabase project/);

    // (b) opted in, pointed elsewhere → safe.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    expect(writesAreSafe().safe).toBe(true);

    // (c) not opted in → skip, never throw, whatever the URL says.
    delete process.env.E2E_ALLOW_WRITES;
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;
    expect(writesAreSafe().safe).toBe(false);
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalOptIn === undefined) delete process.env.E2E_ALLOW_WRITES;
    else process.env.E2E_ALLOW_WRITES = originalOptIn;
  }
});

// ---------------------------------------------------------------------------
// Everything below is gated. Skipped by default; see the interlock above.
// ---------------------------------------------------------------------------
test.describe("money paths (write; disabled — see the header of this file)", () => {
  const gate = writesAreSafe();
  test.skip(!gate.safe, gate.why);

  test("a guest can place an order and is shown a confirmation", async ({
    page,
    request,
  }) => {
    const [storeId] = await discoverStoreIds(request);
    expect(storeId, "Need a storefront with something for sale.").toBeTruthy();

    await page.goto(`/ar/store/${storeId}`);

    // Add the first purchasable product. `.sf-buy` is the checkout button's own
    // class in src/components/store-products.tsx; the add-to-cart control is
    // found by its accessible name rather than a class, because a class is an
    // implementation detail and an accessible name is a promise to the customer.
    const addButton = page.getByRole("button", { name: /\+|أضف/ }).first();
    await expect(
      addButton,
      `No add-to-cart control on /ar/store/${storeId}. Either the store has no ` +
        "available product (a data situation) or the product grid stopped rendering.",
    ).toBeVisible();
    await addButton.click();

    await page.locator(".sf-buy").first().click();

    // Pickup, not delivery: pickup needs no address, and asking a test to invent
    // a plausible Lebanese delivery address is asking it to put junk in a
    // merchant's CRM.
    await page.getByText(AR.pickup).first().click();
    await page.locator("#name").fill("Playwright E2E — please ignore");
    await page.locator("#phone").fill("+96170000000");

    await page.getByRole("button", { name: AR.confirmOrder }).click();

    // The customer-visible promise: the order was taken. Asserting the Arabic
    // confirmation rather than a network response, because what matters is that
    // the person is TOLD, not that a row exists.
    await expect(
      page.getByText(/طلب|رقم/).first(),
      "After confirming, a guest must see an Arabic confirmation with their order " +
        "reference. If this fails, the order may still have been placed while the " +
        "customer was shown nothing — the worst possible outcome on this path.",
    ).toBeVisible({ timeout: 15_000 });
  });

  test("a guest can place a stay booking", async ({ page, request }) => {
    // `place_stay_booking` is the one booking engine that works without a
    // session (src/components/stay-search.tsx:83 does no getUser() check, and
    // 0284 grants it to anon). The appointment and timeslot engines both
    // redirect to /login, so covering them needs a seeded account as well as a
    // safe project — a second prerequisite, noted here so nobody discovers it
    // halfway through enabling this file.
    const ids = await discoverStoreIds(request, "hospitality");
    test.skip(
      ids.length === 0,
      "No hospitality storefront listed, so there is no stay to book. A data " +
        "situation, not a defect.",
    );
    await page.goto(`/ar/store/${ids[0]}`);
    await expect(
      page.locator('[id^="sec-"]'),
      "The hospitality storefront rendered no sections at all.",
    ).not.toHaveCount(0);
    // Intentionally unfinished: the search → select-unit → book sequence needs
    // to be walked against a real seeded unit before it can be written down
    // honestly. Writing a guess here and calling it a test would be worse than
    // this comment.
    test.fixme(
      true,
      "Needs a seeded stay unit on a non-production project to write the " +
        "select-and-book steps against something real.",
    );
  });

  test("/activity shows a signed-in customer their order", async ({ page }) => {
    // /activity hard-redirects to /login when there is no session
    // (src/app/[lang]/(site)/activity/page.tsx:27-31) and reads four tables
    // filtered by customer_id. There is no guest-token path — a guest order is
    // not visible here at all; the guest equivalent is /ar/track/<orderId>.
    //
    // So this test needs BOTH a safe project AND a seeded customer account.
    // Credentials must come from the environment, never from the repo.
    const email = process.env.E2E_TEST_ACCOUNT_EMAIL;
    test.skip(
      !email,
      "E2E_TEST_ACCOUNT_EMAIL is not set. /activity requires a real session and " +
        "there is no seeded test account.",
    );

    await page.goto("/ar/login");
    await page.locator("#email").fill(email!);
    await page.locator("#password").fill(process.env.E2E_TEST_ACCOUNT_PASSWORD ?? "");
    await page.getByRole("button", { name: "دخول" }).click();

    await page.goto("/ar/activity");
    await expect(
      page.getByRole("heading", { name: AR.activityTitle }),
      "A signed-in customer must reach /ar/activity and see the Arabic heading " +
        `"${AR.activityTitle}". Landing on /login instead means the session did not survive.`,
    ).toBeVisible();
  });
});
