"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-pulls server data on an interval — for dashboard screens a merchant
// leaves open (orders, bookings) so new work appears without a manual reload.
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
