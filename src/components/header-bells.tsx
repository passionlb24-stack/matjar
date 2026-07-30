"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-strong px-1 text-[10px] font-bold text-danger-strong-foreground">
      {count > 9 ? "9+" : count}
    </span>
  );
}

// Messages + notifications icons with unread badges — LIVE. Seeded by the server
// (initial* props), then self-updating via a realtime subscription plus a 20s
// visible-tab poll, so the badge moves without a page refresh. Independent of
// any server-render caching.
export function HeaderBells({
  lang,
  dict,
  userId,
  unreadNotifications,
  unreadMessages,
}: {
  lang: Locale;
  dict: Dictionary;
  userId: string | null;
  unreadNotifications: number;
  unreadMessages: number;
}) {
  const [notifs, setNotifs] = useState(unreadNotifications);
  const [msgs, setMsgs] = useState(unreadMessages);
  const router = useRouter();
  const lastNotifs = useRef<number | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let cancelled = false;

    // Also refresh the server-rendered tree (notifications list, dashboard
    // widgets) — debounced. This is the single realtime owner for the app now
    // (the former headless RealtimeNotifications was merged in to avoid a second
    // socket + poll per page).
    const bumpRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 300);
    };

    const refreshCounts = async () => {
      if (document.visibilityState !== "visible") return;
      const [{ count }, { data: msgCount }] = await Promise.all([
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_read", false)
          .neq("type", "message"),
        supabase.rpc("unread_conversation_count"),
      ]);
      if (cancelled) return;
      if (count != null) {
        setNotifs(count);
        // Fallback path (missed realtime event): if the poll sees the count
        // rise, refresh the server content too.
        if (lastNotifs.current !== null && count > lastNotifs.current) {
          bumpRefresh();
        }
        lastNotifs.current = count;
      }
      if (msgCount != null) setMsgs(msgCount as number);
    };

    void supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
    });

    const channel = supabase
      .channel(`bells:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refreshCounts();
          bumpRefresh();
        },
      )
      .subscribe();

    void refreshCounts();
    const poll = setInterval(refreshCounts, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshCounts();
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

  const label = (base: string, count: number) =>
    count > 0 ? `${base} — ${count} ${dict.common.unread}` : base;
  return (
    <>
      <Link
        href={`/${lang}/messages`}
        aria-label={label(dict.common.messages, msgs)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] hover:bg-surface-muted"
      >
        <MessageCircle className="h-5 w-5" />
        <CountBadge count={msgs} />
      </Link>
      <Link
        href={`/${lang}/notifications`}
        aria-label={label(dict.common.notifications, notifs)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] hover:bg-surface-muted"
      >
        <Bell className="h-5 w-5" />
        <CountBadge count={notifs} />
      </Link>
    </>
  );
}
