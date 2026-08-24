// Renders the Play Store feature graphic at exactly 1024x500, and refuses to
// emit one whose content sits too close to an edge.
//
// Not an image-generation model: the brand mark is the real icon-512.png
// embedded as a data URI, and everything around it is laid out in CSS at the
// exact output size, so what ships is pixel-for-pixel what was designed. The
// four accent colours are the sector tints the app itself uses for its home
// gateways (globals.css --tint-2/4/6/7), so the store page and the first screen
// of the app agree.
//
// Google's constraints this obeys: exactly 1024x500, no alpha channel, and the
// load-bearing content kept inside a safe area — the graphic is cropped and
// overlaid differently across Play surfaces, so anything within ~10% of an edge
// can disappear. Decorative background (the awning stripes, the edge bar, the
// floor glow) is EXPECTED to bleed off; the check below therefore measures the
// DOM boxes of the real content rather than looking for non-background pixels,
// which cannot tell a deliberate bleed from a clipped word.
import fs from "fs";
import { chromium } from "@playwright/test";

// Read straight from the shipped icon, so this cannot drift from the app's own
// mark and there is no generated intermediate to keep in sync.
const ICON = fs
  .readFileSync(new URL("../public/icons/icon-512.png", import.meta.url))
  .toString("base64");

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alexandria:wght@700;800&family=IBM+Plex+Sans+Arabic:wght@500;600;700&display=swap">';

const BASE = `
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1024px;height:500px;overflow:hidden}
  body{font-family:"IBM Plex Sans Arabic",sans-serif}
  .stage{position:relative;width:1024px;height:500px;overflow:hidden}
  /* The safe area. Content lives inside this and nowhere else. */
  .safe{position:absolute;inset:0;display:flex;align-items:center;
        justify-content:center;gap:40px;padding:0 92px}
  /* The icon fills its tile rather than sitting inside it. icon-512.png carries
     its own near-white ground and generous internal padding, so at 196px inside
     a 232px white card that ground read as a faint square outline — most
     visible on the light variant, where the card is white too. Letting it fill
     the tile, with the tile clipping to the same radius, makes the icon's own
     ground the tile and the seam disappears. Nothing is lost: the padding it
     crops is the icon's, not the mark's. */
  .mark{width:100%;height:100%;display:block;object-fit:cover}
  .card{flex:none;overflow:hidden;width:232px;height:232px;border-radius:52px}
  .name{font-family:"Alexandria",sans-serif;font-weight:800;font-size:86px;
        line-height:1;letter-spacing:-.01em}
  .lede{margin-top:14px;font-size:27px;font-weight:600;line-height:1.4}
  .sub{margin-top:7px;font-size:21px;font-weight:600}
  .chips{display:flex;gap:11px;margin-top:24px}
  .chip{border-radius:999px;padding:8px 18px;font-size:18px;font-weight:700;
        white-space:nowrap}
`;

const COPY = `
      <div class="chips" data-content>
        <span class="chip" style="background:#fee8d9;color:#8a4602">مطاعم</span>
        <span class="chip" style="background:#c6fcd7;color:#006035">صحة</span>
        <span class="chip" style="background:#e3edff;color:#24509f">تسوّق</span>
        <span class="chip" style="background:#f2e8ff;color:#6c3d99">خدمات</span>
      </div>`;

/* ── A: the shopfront ────────────────────────────────────────────────────────
   The awning in the mark is the idea — a row of Lebanese shopfronts under one
   roof — so the background is that awning, drawn wide and low-contrast rather
   than as ornament. The four sector colours sit under the words as the four
   doors the app actually opens on. */
const A = `
<div class="stage" dir="rtl" style="background:
    radial-gradient(120% 90% at 76% 6%, #1f6ae0 0%, #1556c2 38%, #0d3d8f 72%, #08284f 100%)">
  <div style="position:absolute;inset:-60px -40px auto -40px;height:250px;
       background:repeating-linear-gradient(105deg,
         rgba(255,255,255,.075) 0 46px, rgba(255,255,255,0) 46px 92px);
       transform:skewY(-4deg)"></div>
  <div style="position:absolute;left:-10%;right:-10%;bottom:-190px;height:330px;
       background:radial-gradient(50% 100% at 50% 0%, rgba(90,160,255,.30), transparent 70%)"></div>

  <div class="safe">
    <div style="text-align:right">
      <div class="name" data-content style="color:#fff;text-shadow:0 3px 22px rgba(0,0,0,.28)">متجر</div>
      <div class="lede" data-content style="color:#dce9ff">متاجر ومطاعم وعيادات وخدمات لبنان</div>
      <div class="sub" data-content style="color:#8fc0ff">بمكان واحد — والدفع نقداً عند الاستلام</div>
      ${COPY}
    </div>
    <div class="card" data-content style="background:rgba(255,255,255,.97);
         box-shadow:0 26px 60px rgba(3,18,44,.42)">
      <img class="mark" src="data:image/png;base64,${ICON}" alt="">
    </div>
  </div>
</div>`;

/* ── B: the calm one ─────────────────────────────────────────────────────────
   Same identity on a light ground. It survives being shrunk to a thumbnail
   better, and it sits next to screenshots that are themselves mostly white —
   which is what this app looks like. */
const B = `
<div class="stage" dir="rtl" style="background:
    linear-gradient(160deg,#ffffff 0%,#f2f6fd 46%,#e2ecfb 100%)">
  <div style="position:absolute;inset:auto -60px -220px -60px;height:390px;
       background:radial-gradient(50% 100% at 50% 0%, rgba(21,86,194,.12), transparent 72%)"></div>
  <div style="position:absolute;inset-inline-end:0;top:0;bottom:0;width:14px;
       background:linear-gradient(#1f6ae0,#0d3d8f)"></div>

  <div class="safe">
    <div style="text-align:right">
      <div class="name" data-content style="color:#0b2b60">متجر</div>
      <div class="lede" data-content style="color:#22406f">متاجر ومطاعم وعيادات وخدمات لبنان</div>
      <div class="sub" data-content style="color:#1556c2">بمكان واحد — والدفع نقداً عند الاستلام</div>
      ${COPY}
    </div>
    <div class="card" data-content style="background:#fff;
         box-shadow:0 22px 50px rgba(13,61,143,.20)">
      <img class="mark" src="data:image/png;base64,${ICON}" alt="">
    </div>
  </div>
</div>`;

const SAFE_PCT = 0.08; // content must clear 8% of every edge
const browser = await chromium.launch();
let failures = 0;

for (const [name, body] of [["feature-graphic-dark", A], ["feature-graphic-light", B]]) {
  const page = await browser.newPage({
    viewport: { width: 1024, height: 500 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<!doctype html><html dir="rtl"><head>${FONTS}<style>${BASE}</style></head><body>${body}</body></html>`,
    { waitUntil: "networkidle" },
  );
  // Without this the Arabic is measured and captured in the fallback face,
  // before the real one swaps in — different metrics, different screenshot.
  await page.evaluate(() => document.fonts.ready);

  const box = await page.evaluate(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const el of document.querySelectorAll("[data-content]")) {
      const r = el.getBoundingClientRect();
      minX = Math.min(minX, r.left); maxX = Math.max(maxX, r.right);
      minY = Math.min(minY, r.top);  maxY = Math.max(maxY, r.bottom);
    }
    return { minX, maxX, minY, maxY };
  });

  const m = {
    left: box.minX / 1024,
    right: (1024 - box.maxX) / 1024,
    top: box.minY / 500,
    bottom: (500 - box.maxY) / 500,
  };
  const tight = Object.entries(m).filter(([, v]) => v < SAFE_PCT).map(([k]) => k);
  const centre = (box.minX + box.maxX) / 2;

  console.log(name);
  console.log(
    `  content margins — left ${(m.left * 100).toFixed(1)}%  right ${(m.right * 100).toFixed(1)}%` +
      `  top ${(m.top * 100).toFixed(1)}%  bottom ${(m.bottom * 100).toFixed(1)}%`,
  );
  console.log(`  centred at ${centre.toFixed(0)} of 512 (off by ${(centre - 512).toFixed(0)}px)`);

  if (tight.length) {
    console.log(`  FAIL: too close to ${tight.join(", ")} (need ${SAFE_PCT * 100}%)`);
    failures++;
  } else {
    console.log("  OK: clears 8% on every edge");
    await page.screenshot({ path: `docs/store-assets/${name}.png`, omitBackground: false });
    console.log(`  wrote docs/store-assets/${name}.png`);
  }
  await page.close();
}

await browser.close();
if (failures) {
  console.error(`\n${failures} graphic(s) not written — fix the layout, do not ship a cropped word.`);
  process.exit(1);
}
