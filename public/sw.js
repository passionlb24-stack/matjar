/* Matjar service worker — Web Push, plus a deliberately small app-shell cache. */

// The cache name is the deploy, not a string somebody remembers to edit.
//
// It used to read `"matjar-shell-v1"`, with a comment telling the next person to
// bump it. Nobody ever did — so a change to offline.html or to SHELL below
// reached nobody already on v1: the `activate` sweep compares every cache
// against this name, and while the name never changed there was nothing to
// sweep and nothing to refill.
//
// `?v=` on the script URL carries the build id (src/lib/sw.ts sets it from
// next.config's BUILD_ID, which is the commit). `self.location` inside a worker
// is that script URL, query included, so the worker can read its own version
// without a build step ever touching this file.
//
// Repeat visit, no deploy: the page registers the identical URL, the browser
// matches the existing registration, no new worker installs, VERSION is
// unchanged, and this cache is left exactly as it is. Nothing is re-fetched.
//
// The `|| "v1"` is not a fallback for a missing deploy — it is what a worker
// registered by an OLD page (plain `/sw.js`, no query) computes, so such a
// worker keeps owning the cache it already filled instead of orphaning it.
const VERSION = new URL(self.location.href).searchParams.get("v") || "v1";
const CACHE = `matjar-shell-${VERSION}`;

// The only things worth holding: the offline page and the icons that dress it.
// Deliberately NOT the pages themselves — see the fetch handler.
// icon-192 rather than the app icon: /icon.png is the 512 master Next serves
// for the favicon, and offline.html renders it at 56px. Precaching a 512 to
// draw a thumbnail cost every install the full file for nothing.
const SHELL = ["/offline.html", "/icons/icon-192.png", "/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      // A failed precache must not block installation — the app works online
      // regardless, and the offline page is a nicety, not a dependency.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// What must NEVER be cached: anything private or transactional. A stale order
// status, a stale cart total or a stale merchant dashboard is worse than no
// answer at all, because the customer believes it. Supabase traffic, the API
// routes, and every authenticated screen are network-only, always.
const NEVER_CACHE = [
  "/api/",
  "/auth/",
  "/merchant",
  "/admin",
  "/account",
  "/activity",
  "/orders",
  "/bookings",
  "/messages",
  "/checkout",
];

function isPrivate(url) {
  return (
    url.origin !== self.location.origin ||
    NEVER_CACHE.some((p) => url.pathname.includes(p))
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (isPrivate(url)) return; // straight to the network, never stored

  // Navigations: network first, and only when the network is genuinely gone do
  // we show the offline page. Never a cached copy of a real page — a shop's
  // opening hours or stock from yesterday is a lie told confidently.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match("/offline.html").then((r) => r ?? Response.error()),
      ),
    );
    return;
  }

  // Static build assets are content-hashed, so a hit is always correct.
  if (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|jpg|jpeg|svg|webp|avif|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            // Opaque or failed responses are not worth keeping.
            if (res.ok && res.type === "basic") {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "متجر", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "متجر";
  const options = {
    body: data.body || "",
    icon: "/icon.png",
    badge: "/icon.png",
    dir: "rtl",
    lang: "ar",
    data: { url: data.url || "/ar" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/ar";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
