"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Live bell without a manual refresh. Two independent mechanisms so it works
// even if realtime is flaky:
//   1) Realtime INSERT subscription (instant) — needs the socket authed with
//      the user's JWT, or RLS drops the rows; we set that explicitly.
//   2) A cheap unread-count poll every 20s while the tab is visible (the
//      guaranteed fallback) — only refreshes when the count actually changes.
export function RealtimeNotifications({ userId }: { userId: string }) {
  const router = useRouter();
  const lastCount = useRef<number | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let cancelled = false;

    const bumpRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 300);
    };

    // Poll the unread count; refresh the server-rendered badge only on change.
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      if (cancelled || count == null) return;
      if (lastCount.current !== null && count !== lastCount.current) {
        router.refresh();
      }
      lastCount.current = count;
    };

    // Authenticate the realtime socket so RLS delivers this user's rows.
    void supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
    });

    const channel = supabase
      .channel(`notif:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        bumpRefresh,
      )
      .subscribe();

    void check();
    const poll = setInterval(check, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}
