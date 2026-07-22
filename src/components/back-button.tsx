"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Context-aware back button for inner pages. Uses browser history when there's
// somewhere to go back to, otherwise falls back to a sensible href. RTL-aware
// (the arrow flips in Arabic, per the app convention).
export function BackButton({
  label,
  fallbackHref,
  className = "",
}: {
  label: string;
  fallbackHref?: string;
  className?: string;
}) {
  const router = useRouter();
  const onBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else if (fallbackHref) {
      router.push(fallbackHref);
    }
  };
  return (
    <button
      type="button"
      onClick={onBack}
      className={`inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground ${className}`}
    >
      <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
      {label}
    </button>
  );
}
