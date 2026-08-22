// ===== App mode =====
//
// ONE signal for "this page is being rendered inside the Capacitor shell, not
// in a browser": the attribute `data-app="native"` on <html>.
//
// Why an attribute and not a React context: the things that have to change in
// the app are *removals* — the sitemap footer, the merchant CTA, the language
// switcher — and a removal decided after hydration is a flash, which reads
// worse than leaving the thing in place. An attribute on the root element can
// be set by a blocking script in <head>, before the body is painted, and CSS
// can then act on it in the very first style resolution. Nothing renders and
// then disappears.
//
// Why not decide it on the server from the request headers: every public page
// here is statically rendered or cached, and reading headers() to branch on the
// user agent would opt all of them out of that. The app is a WebView pointed at
// the same cached HTML the web gets; only the presentation differs, so the
// branch belongs in the client's first paint, not in the render.
//
// ── How the signal is detected ────────────────────────────────────────────────
//
// Primary: the user agent. `capacitor.config.ts` appends APP_UA_TOKEN to the
// WebView's UA (`appendUserAgent`), so `navigator.userAgent` carries it from the
// first byte of script execution — no plugin, no bridge, no timing.
//
// Secondary: `window.Capacitor.isNativePlatform()`. In a hosted-hybrid setup
// (server.url points at the live site) the bridge is injected by the native
// layer, and there is no contract that it exists before the document's own
// first inline script runs. It is checked because when it IS there it is
// authoritative, and because it keeps an older installed binary — one built
// before the UA token was added — working.
//
// The two are OR'd. A false positive on the web would need a browser whose UA
// contains APP_UA_TOKEN, which is why the token is a name and not a word.

/** Appended to the WebView user agent by capacitor.config.ts. */
export const APP_UA_TOKEN = "MatjarApp";

/** The attribute + value that every app-mode CSS rule keys on. */
export const APP_MODE_ATTR = "data-app";
export const APP_MODE_VALUE = "native";

/**
 * Blocking <head> script. Runs before the body is parsed, so the attribute is
 * on <html> before the first style resolution and nothing flashes.
 *
 * Wrapped in try/catch: on the web this must never be able to throw and take
 * the theme script or the page with it.
 */
export const APP_MODE_BOOT_SCRIPT = `try{var d=document.documentElement,n=navigator.userAgent||"",c=window.Capacitor;if(n.indexOf("${APP_UA_TOKEN}")>-1||(c&&typeof c.isNativePlatform==="function"&&c.isNativePlatform()))d.setAttribute("${APP_MODE_ATTR}","${APP_MODE_VALUE}")}catch(e){}`;

/**
 * The app-mode rules that MUST reach the browser, inlined into <head>.
 *
 * These are deliberately NOT in globals.css. A rule written there compiled
 * correctly in a local production build and then never appeared in any
 * stylesheet the live site loaded — twice, including after a clean rebuild (see
 * the .leaflet-bar note at the foot of globals.css). Whatever that is, an
 * inline <style> in the document cannot be subject to it: there is no chunk to
 * drop, no ordering to lose, and it arrives in the same response as the markup
 * it styles. Everything here is load-bearing — if `[data-app-hide]` fails to
 * apply, the app shows 1115px of website footer.
 *
 * Cosmetic app polish (press states, page fade, chrome selection) lives in
 * globals.css, where a miss costs nothing structural.
 *
 * Kept to a few hundred bytes because it ships in the HTML of every page.
 */
export const APP_MODE_CRITICAL_CSS = [
  // Hidden in the app, present on the web. The web must be byte-identical to
  // what it was, so there is no rule at all for the non-app case.
  `html[${APP_MODE_ATTR}="${APP_MODE_VALUE}"] [data-app-hide]{display:none!important}`,
  // The mirror image: shown only in the app. Hidden by default so the web never
  // renders it, and `display:block` (not `revert`) so the app gets a defined
  // box rather than whatever the UA default happened to be.
  `[data-app-only]{display:none!important}`,
  `html[${APP_MODE_ATTR}="${APP_MODE_VALUE}"] [data-app-only]{display:block!important}`,
  // No pull-to-refresh, no rubber-band edge. On both elements because the
  // viewport takes its overscroll behaviour from <html> when <html> sets one,
  // and from <body> only when <html> is `auto`.
  `html[${APP_MODE_ATTR}="${APP_MODE_VALUE}"],html[${APP_MODE_ATTR}="${APP_MODE_VALUE}"] body{overscroll-behavior:none}`,
].join("");

/**
 * Client-side read of the same signal, for the rare case that needs JavaScript
 * rather than CSS. Returns false during SSR and on the web.
 *
 * Prefer CSS. A component that branches on this renders differently before and
 * after hydration, which is the flash this whole module exists to avoid.
 */
export function isAppMode(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.documentElement.getAttribute(APP_MODE_ATTR) === APP_MODE_VALUE
  );
}
