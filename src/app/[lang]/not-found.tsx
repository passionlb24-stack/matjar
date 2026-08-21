import Link from "next/link";
import { supportWaLink } from "@/lib/support";

// Localized 404. Params aren't available to not-found boundaries, so it links to
// the root and lets the locale proxy route to the default language.
//
// This page used to answer HTTP 200 rather than 404, and the note here used to
// argue that was an acceptable trade. It is fixed, and the argument was wrong,
// so both are recorded rather than quietly deleted.
//
// The mechanism: `notFound()` can only set a status while the response has not
// started, and `(site)/loading.tsx` put a Suspense boundary above every page in
// the group, so Next flushed a skeleton with a 200 before the page body
// discovered the record was missing. That much was diagnosed correctly — by
// removing the file, rebuilding, and watching /ar/<unknown-slug> become a real
// 404.
//
// The wrong part was the conclusion: that keeping an instant skeleton on ~40
// routes beat a status code on URLs nobody meant to request. 6086d58 measured
// what that boundary actually cost — with it in place, /ar and /ar/merchants
// shipped **zero** characters inside <main>, so a crawler, and any phone that
// never finished hydrating, saw the skeleton and nothing else. The skeleton was
// not buying a nicer wait; it was withholding every public page's content from
// everyone who does not run JavaScript.
//
// Worth keeping from the old note, because it is still true and still
// counter-intuitive: Next already emits <meta name="robots" content="noindex">
// on any page reached through notFound(). An explicit tag added here never
// reached <head> — it appeared only in the flight payload, because Next's own
// tag already holds that slot.
//
// e2e/smoke.spec.ts asserts the 404 status. It was a `test.fail()` while this
// stood, which is how the fix announced itself: the suite went red with
// "expected to fail, but passed".
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
      {/* A dead link is often a link somebody was GIVEN — a shop's card, a
          WhatsApp forward — so the person standing here may be looking for a
          real business and holding a URL that no longer resolves. Home does not
          help them find it; a human can. Quiet on purpose: this is the second
          thing to try, not the first.
          No dictionary here — a not-found boundary gets no params, so there is
          no locale to look one up with. Both languages, like the copy above. */}
      <a
        href={supportWaLink()}
        target="_blank"
        rel="noopener noreferrer"
        className="min-h-11 text-sm font-semibold text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-whatsapp"
      >
        بتدوّر على شي محدّد؟ احكينا · Ask us
      </a>
    </div>
  );
}
