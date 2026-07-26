"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-pulls server data on an interval — for dashboard screens a merchant
// leaves open (orders, bookings) so new work appears without a manual reload.
//
// CPU-aware: every tick is a FULL server render, and a tab forgotten in the
// background used to keep polling forever — one such tab could burn through
// the host's entire monthly compute budget. Polling now runs only while the
// tab is actually visible; returning to the tab refreshes immediately.
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (t == null) t = setInterval(() => router.refresh(), seconds * 1000);
    }
    function stop() {
      if (t != null) {
        clearInterval(t);
        t = null;
      }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        router.refresh(); // catch up on whatever happened while hidden
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, seconds]);
  return null;
}
