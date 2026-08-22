import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APP_MODE_ATTR,
  APP_MODE_BOOT_SCRIPT,
  APP_MODE_CRITICAL_CSS,
  APP_MODE_VALUE,
  APP_UA_TOKEN,
} from "@/lib/app-mode";

const repoRoot = join(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(join(repoRoot, p), "utf8");

// The app-mode signal is a contract between three files that never import one
// another: capacitor.config.ts writes the token into the WebView's user agent,
// src/lib/app-mode.ts looks for it, and the components carry the attributes the
// CSS acts on. Nothing type-checks across that boundary, and a break is
// invisible rather than loud — the app does not crash, it just quietly starts
// looking like a website again, which is the exact bug this mechanism exists to
// fix. So it is asserted here.
describe("app mode signal", () => {
  it("capacitor appends the same UA token the boot script looks for", () => {
    const cap = read("capacitor.config.ts");

    // The config declares the token locally (it cannot import from src/ — the
    // Capacitor CLI loads this file on its own), so both halves are checked.
    expect(cap).toContain(`const APP_UA_TOKEN = "${APP_UA_TOKEN}";`);
    // The token must be the PREFIX of whatever is appended, because the boot
    // script matches on the token alone. What follows the slash is the build
    // number and is meant to vary — CI supplies it through MATJAR_BUILD — so
    // this deliberately does not pin a literal. It pinned `/1` once, and the
    // first attempt to stamp a build number then failed this assertion instead
    // of the thing that was actually broken.
    expect(cap).toMatch(
      /appendUserAgent:\s*`\$\{APP_UA_TOKEN\}\/\$\{[A-Za-z_]+\}`/,
    );

    // `overrideUserAgent` would replace the WebView UA rather than extend it,
    // and Capacitor documents it as making `appendUserAgent` a no-op. Matched
    // as a config KEY, so the word can still be discussed in a comment.
    expect(cap).not.toMatch(/^\s*overrideUserAgent\s*:/m);

    expect(APP_MODE_BOOT_SCRIPT).toContain(APP_UA_TOKEN);
  });

  it("the boot script sets the attribute the critical CSS keys on", () => {
    expect(APP_MODE_BOOT_SCRIPT).toContain(
      `setAttribute("${APP_MODE_ATTR}","${APP_MODE_VALUE}")`,
    );
    expect(APP_MODE_CRITICAL_CSS).toContain(
      `html[${APP_MODE_ATTR}="${APP_MODE_VALUE}"]`,
    );
  });

  it("the boot script cannot throw on the web", () => {
    // It runs before anything else in <head>. If it throws it takes the theme
    // script and the page's first paint with it.
    expect(APP_MODE_BOOT_SCRIPT.startsWith("try{")).toBe(true);
    expect(APP_MODE_BOOT_SCRIPT.endsWith("catch(e){}")).toBe(true);
  });

  it("sets the attribute for a Capacitor user agent and not for a browser one", () => {
    // Exercises the real script text rather than a paraphrase of it.
    const run = (userAgent: string, capacitor?: unknown) => {
      const attrs: Record<string, string> = {};
      const scope = {
        document: {
          documentElement: {
            setAttribute: (k: string, v: string) => {
              attrs[k] = v;
            },
          },
        },
        navigator: { userAgent },
        window: { Capacitor: capacitor },
      };
      new Function(
        "document",
        "navigator",
        "window",
        APP_MODE_BOOT_SCRIPT,
      )(scope.document, scope.navigator, scope.window);
      return attrs[APP_MODE_ATTR];
    };

    const androidShell = `Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36 ${APP_UA_TOKEN}/1`;
    const chromeAndroid =
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";
    const iphoneSafari =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";

    expect(run(androidShell)).toBe(APP_MODE_VALUE);
    expect(run(chromeAndroid)).toBeUndefined();
    expect(run(iphoneSafari)).toBeUndefined();

    // Fallback path: an older installed binary, built before the UA token
    // existed, still identifies itself through the injected bridge.
    expect(run(chromeAndroid, { isNativePlatform: () => true })).toBe(
      APP_MODE_VALUE,
    );
    // …and the web's Capacitor shim, which reports false, must not trip it.
    expect(run(chromeAndroid, { isNativePlatform: () => false })).toBeUndefined();
  });

  it("hides the footer only in app mode, and hides app-only blocks on the web", () => {
    // The two rules the whole feature rests on. `!important` on both: they have
    // to beat a Tailwind display utility on the same element.
    expect(APP_MODE_CRITICAL_CSS).toContain(
      `html[${APP_MODE_ATTR}="${APP_MODE_VALUE}"] [data-app-hide]{display:none!important}`,
    );
    expect(APP_MODE_CRITICAL_CSS).toContain(
      "[data-app-only]{display:none!important}",
    );
    // There must be NO unscoped rule touching [data-app-hide] — that would
    // change the website, which is the one thing this may not do.
    const unscoped = APP_MODE_CRITICAL_CSS.split("}")
      .map((r) => `${r}}`)
      .filter(
        (r) =>
          r.includes("[data-app-hide]") &&
          !r.includes(`[${APP_MODE_ATTR}="${APP_MODE_VALUE}"]`),
      );
    expect(unscoped).toEqual([]);
  });

  it("the footer and the app-only account block carry the attributes", () => {
    expect(read("src/components/site-footer.tsx")).toContain(
      'data-app-hide="footer"',
    );
    expect(read("src/components/site-header.tsx")).toContain(
      'data-app-hide="merchant-cta"',
    );
    expect(read("src/components/site-header.tsx")).toContain(
      'data-app-hide="lang"',
    );
    expect(read("src/app/[lang]/(site)/account/page.tsx")).toContain(
      "data-app-only",
    );
  });

  it("the critical rules are inlined in <head>, not left to globals.css", () => {
    // A rule in globals.css compiled correctly in a local production build and
    // then never appeared in any stylesheet the live site loaded — twice (see
    // the .leaflet-bar note at the foot of that file). The removals here are
    // structural: if they do not arrive, the app shows the website footer. So
    // they ship in the document itself.
    const layout = read("src/app/[lang]/layout.tsx");
    expect(layout).toContain("APP_MODE_BOOT_SCRIPT");
    expect(layout).toContain("APP_MODE_CRITICAL_CSS");

    const globals = read("src/app/globals.css");
    expect(globals).not.toContain("[data-app-hide]");
    expect(globals).not.toContain("[data-app-only]");
  });
});
