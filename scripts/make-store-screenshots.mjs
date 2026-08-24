// Play Store phone screenshots, captured from the LIVE site at a real phone
// resolution.
//
// Captured with the app's user-agent token, deliberately. These illustrate the
// app, and in the app the sitemap footer and the merchant call-to-action are
// hidden — a screenshot showing website chrome would be advertising something
// the installed app does not look like.
//
// 393x852 at deviceScaleFactor 3 gives 1179x2556: a genuine modern phone
// resolution, comfortably inside Play's 320..3840 bounds and its 9:16-ish
// aspect expectation. Full-page capture is NOT used — Play screenshots are
// meant to be a screen, not a scroll of the whole document.
//
// Nothing here signs in and nothing is ever ordered: every screen below is
// reachable as a guest, and the cart is filled by clicking add-to-cart in the
// page, which is local state. The confirm button is never touched.
import fs from "fs";
import { chromium } from "@playwright/test";

const SITE = process.env.SITE || "https://matjarlb.com";
const OUT = "docs/store-assets/screenshots";
const APP_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Mobile Safari/537.36 MatjarApp/6";

const BUTCHER = "eba7a970-3ad9-49f8-8901-1349429e9892"; // ملحمة البركة
const CLINIC = "265a2121-95ff-4bd5-8b6c-98b050c5cfc7"; // مركز الضنية الطبي

/** Wait until the streamed rails have actually resolved, not just until the
 *  network went quiet — a skeleton screenshots as cleanly as real content. */
async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page
    .waitForFunction(() => !document.querySelector("[data-skeleton], .animate-pulse"), {
      timeout: 8000,
    })
    .catch(() => {});
}

const shots = [
  {
    name: "01-home",
    why: "The first screen: where you are, what you want, and what is open now.",
    go: async (p) => {
      await p.goto(`${SITE}/ar`);
      await settle(p);
    },
  },
  {
    name: "02-storefront",
    why: "A storefront with its catalogue and the sticky order bar.",
    go: async (p) => {
      await p.goto(`${SITE}/ar/store/${BUTCHER}`);
      await settle(p);
    },
  },
  {
    name: "03-search",
    why: "Searching a city — the thing a Lebanese customer types first.",
    go: async (p) => {
      await p.goto(`${SITE}/ar/search?q=${encodeURIComponent("طرابلس")}`);
      await settle(p);
    },
  },
  {
    name: "04-clinic",
    why: "A clinic: the same app, a different transaction — appointments, not a cart.",
    go: async (p) => {
      await p.goto(`${SITE}/ar/store/${CLINIC}`);
      await settle(p);
    },
  },
  {
    name: "05-explore",
    why: "Browsing every shop with the filters.",
    go: async (p) => {
      await p.goto(`${SITE}/ar/explore`);
      await settle(p);
    },
  },
];

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  userAgent: APP_UA,
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  locale: "ar",
  isMobile: true,
  hasTouch: true,
});

const report = [];
for (const s of shots) {
  const page = await ctx.newPage();
  try {
    await s.go(page);
    const check = await page.evaluate(() => ({
      appMode: document.documentElement.getAttribute("data-app") === "native",
      footerH: (() => {
        const f = document.querySelector("footer");
        return f ? Math.round(f.getBoundingClientRect().height) : 0;
      })(),
      overflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      title: (document.querySelector("h1")?.textContent || "").trim().slice(0, 40),
    }));
    await page.screenshot({ path: `${OUT}/${s.name}.png` });
    report.push({ ...s, ...check, ok: check.appMode && check.footerH === 0 && check.overflow === 0 });
  } catch (e) {
    report.push({ ...s, error: String(e).slice(0, 90), ok: false });
  }
  await page.close();
}
await browser.close();

console.log(`\ncaptured into ${OUT}/  (1179x2556)\n`);
for (const r of report) {
  console.log(
    `${r.ok ? "OK  " : "WARN"} ${r.name}  appMode=${r.appMode} footer=${r.footerH}px ` +
      `overflow=${r.overflow}${r.title ? ` h1="${r.title}"` : ""}${r.error ? ` ERROR ${r.error}` : ""}`,
  );
}
const bad = report.filter((r) => !r.ok);
if (bad.length) {
  console.error(
    `\n${bad.length} screenshot(s) not in app mode, showing a footer, or overflowing — ` +
      `do not ship those to Play.`,
  );
  process.exit(1);
}
