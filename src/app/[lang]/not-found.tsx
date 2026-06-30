import Link from "next/link";

// Localized 404. Params aren't available to not-found boundaries, so it links to
// the root and lets the locale proxy route to the default language.
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
