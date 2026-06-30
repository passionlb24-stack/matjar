"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced to the browser console for debugging; no PII.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-extrabold">حدث خطأ ما</h1>
      <p className="max-w-sm text-muted-foreground">
        صار خطأ غير متوقّع. جرّب مرة تانية.
        <br />
        <span className="text-sm">Something went wrong. Please try again.</span>
      </p>
      <button
        onClick={reset}
        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        إعادة المحاولة · Retry
      </button>
    </div>
  );
}
