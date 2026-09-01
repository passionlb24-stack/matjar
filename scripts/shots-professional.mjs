// BEFORE/AFTER screenshots for the professional-marketplace work (§37).
//
//   node scripts/shots-professional.mjs before
//   node scripts/shots-professional.mjs after
//
// Runs against a locally built production server (SITE overrides it), at the
// five viewports the brief names, Arabic RTL. Writes into
// docs/professional-v2/<phase>/.
//
// It waits for streamed sections to resolve rather than for the network to fall
// quiet: a skeleton screenshots exactly as cleanly as real content, and this
// repository has already recorded one measurement taken of precisely that.
import fs from "fs";
import { chromium } from "@playwright/test";

const phase = process.argv[2];
if (!["before", "after"].includes(phase)) {
  console.error("usage: node scripts/shots-professional.mjs <before|after>");
  process.exit(2);
}
const SITE = process.env.SITE || "http://127.0.0.1:3000";
const OUT = `docs/professional-v2/${phase}`;

const VIEWPORTS = [
  { w: 360, h: 800 },
  { w: 390, h: 844 },
  { w: 430, h: 932 },
  { w: 768, h: 1024 },
  { w: 1440, h: 900 },
];

// The gig that exists, and the freelancer who owns all three of them.
const GIG = "138fb16e-1282-4491-a547-9ed486b4acc4";
const FREELANCER = "8b6f9cdc-3100-4f4b-a2df-3cb3e7c1e80a";

const PAGES = [
  { name: "crafts-landing", path: "/ar/crafts" },
  { name: "crafts-trade", path: "/ar/crafts/electrician" },
  { name: "crafts-request", path: "/ar/crafts/requests" },
  { name: "crafts-join", path: "/ar/crafts/join" },
  { name: "freelance-landing", path: "/ar/freelance" },
  { name: "freelance-gig", path: `/ar/freelance/${GIG}` },
  { name: "freelance-pro", path: `/ar/freelance/pro/${FREELANCER}` },
];

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const rows = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 2,
    locale: "ar",
    isMobile: vp.w < 768,
    hasTouch: vp.w < 768,
  });
  for (const p of PAGES) {
    const page = await ctx.newPage();
    let status = 0;
    let note = "";
    try {
      const resp = await page.goto(SITE + p.path, { waitUntil: "networkidle", timeout: 45000 });
      status = resp?.status() ?? 0;
      await page.evaluate(() => document.fonts.ready);
      await page
        .waitForFunction(() => !document.querySelector("[data-skeleton], .animate-pulse"), { timeout: 6000 })
        .catch(() => {});
      const m = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        h: document.documentElement.scrollHeight,
        h1: (document.querySelector("h1")?.textContent || "").trim().slice(0, 46),
      }));
      note = `h=${m.h} ovf=${m.overflow}${m.h1 ? ` h1="${m.h1}"` : ""}`;
      await page.screenshot({ path: `${OUT}/${p.name}@${vp.w}.png`, fullPage: false });
    } catch (e) {
      note = "ERROR " + String(e).slice(0, 70);
    }
    rows.push({ vp: vp.w, name: p.name, status, note });
    await page.close();
  }
  await ctx.close();
}
await browser.close();

console.log(`\n${phase.toUpperCase()} → ${OUT}/\n`);
for (const r of rows) {
  const flag = r.status >= 400 || r.note.startsWith("ERROR") ? "!!" : r.note.includes("ovf=0") ? "ok" : "??";
  console.log(`${flag} ${String(r.vp).padStart(4)}  ${r.name.padEnd(20)} ${r.status}  ${r.note}`);
}
const bad = rows.filter((r) => r.note.includes("ovf=") && !r.note.includes("ovf=0"));
if (bad.length) console.log(`\n${bad.length} page/viewport pair(s) scroll horizontally.`);
