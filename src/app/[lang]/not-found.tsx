import Link from "next/link";

// Localized 404. Params aren't available to not-found boundaries, so it links to
// the root and lets the locale proxy route to the default language.
//
// This page answers HTTP 200, not 404. `notFound()` can only set the status
// while the response has not started, and every page under `(site)` and
// `(dashboard)` sits beneath a `loading.tsx` — a Suspense boundary — so Next has
// already flushed the shell with a 200 by the time the page body discovers the
// record does not exist. Verified rather than reasoned: removing
// `(site)/loading.tsx` and rebuilding turns /ar/<unknown-slug> into a real 404,
// and putting it back restores the 200.
//
// Deliberately left alone. Fixing it means giving up the instant skeleton on
// roughly forty routes, on a market with slow connections, in exchange for a
// status code on URLs nobody had a reason to request.
//
// The usual argument for caring — a crawler reads 200 and indexes a dead URL —
// does not apply here: Next already emits <meta name="robots" content="noindex">
// on any page reached through notFound(). Checked in the built HTML, and checked
// against the homepage, which carries no robots tag at all. An explicit tag was
// tried here first and never reached <head>; it appeared only in the flight
// payload, because Next's own tag is already holding that slot. So it was
// removed rather than left in as decoration.
//
// What does stay broken is that uptime and error monitoring cannot detect a miss
// from the status alone. If that starts to matter, move the vanity-slug route
// into its own group with no `loading.tsx` above it — then one route trades its
// skeleton for a correct status and the other forty keep theirs.
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-5xl font-extrabold text-primary">404</p>
      <h1 className="text-2xl font-extrabold">الصفحة غير موجودة</h1>
      <p className="max-w-sm text-muted-foreground">
        ما لقينا هالصفحة. ممكن تكون انحذفت أو الرابط غلط.
        <br />
        <span className="text-sm">This page could not be found.</span>
      </p>
      <Link
        href="/"
        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        العودة للرئيسية · Home
      </Link>
    </div>
  );
}
