// The one URL the service worker is ever registered from (MP-035).
//
// The `?v=` is not decoration and it is not a cache-buster for the *script* —
// it is how the worker learns which deploy it belongs to. `public/sw.js` is a
// static file with no build step over it, so it cannot have a version baked in;
// instead it reads this query off its own `self.location` and names its cache
// `matjar-shell-<v>`. A deploy changes the value, the new worker fills a new
// cache, and its `activate` sweep deletes every cache that is not the new one.
//
// It happens to bust the script too, and that part matters for the migration:
// registering a *different* scriptURL on an existing registration is what makes
// the browser install a new worker, so devices still carrying the old
// unversioned `/sw.js` and its `matjar-shell-v1` pick this up on their next
// visit rather than sitting on v1 forever.
//
// What it deliberately does NOT do is bust anything on a repeat visit with no
// deploy in between: BUILD_ID is the commit, so the URL is byte-identical, the
// browser finds the same registration and the same script, no new worker is
// installed, and the existing cache keeps serving. Anything that varied per
// request or per session here — a timestamp, a random — would re-install the
// worker and re-download the shell on every page load.
//
// Every caller must use this constant. Two registrations at two different URLs
// for the same scope would fight, each replacing the other's worker.
export const SW_URL = `/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID || "dev"}`;
