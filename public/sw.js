/* Matjar service worker — Web Push, plus a deliberately small app-shell cache. */

// Bump this to retire every previous cache in one go. Versioned because a
// service worker that keeps yesterday's JS alive is worse than none: the app
// half-updates and the failures make no sense to anyone.
const CACHE = "matjar-shell-v1";

// The only things worth holding: the offline page and the icons that dress it.
// Deliberately NOT the pages themselves — see the fetch handler.
const SHELL = ["/offline.html", "/icon.png", "/logo.png"];

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
