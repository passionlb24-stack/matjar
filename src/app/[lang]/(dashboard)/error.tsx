"use client";

import { useEffect } from "react";
import { Container } from "@/components/ui/container";

// Dashboard-scoped error boundary so a data hiccup inside the merchant/admin
// panel shows a friendly retry inside the panel chrome instead of bubbling to
// the bare root error page.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-16">
      <Container className="max-w-md text-center">
        <h1 className="text-2xl font-extrabold">حدث خطأ ما</h1>
        <p className="mt-2 text-muted-foreground">
          صار خطأ غير متوقّع باللوحة. جرّب مرة تانية.
          <br />
          <span className="text-sm">Something went wrong. Please try again.</span>
        </p>
        <button
          onClick={reset}
          className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          إعادة المحاولة · Retry
        </button>
      </Container>
    </div>
  );
}
