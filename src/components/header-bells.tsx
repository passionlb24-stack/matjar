"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
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

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let cancelled = false;

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
      if (count != null) setNotifs(count);
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
        () => void refreshCounts(),
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
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const label = (base: string, count: number) =>
    count > 0 ? `${base} — ${count} ${dict.common.unread}` : base;
  return (
    <>
      <Link
        href={`/${lang}/messages`}
        aria-label={label(dict.common.messages, msgs)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-muted"
      >
        <MessageCircle className="h-5 w-5" />
        <CountBadge count={msgs} />
      </Link>
      <Link
        href={`/${lang}/notifications`}
        aria-label={label(dict.common.notifications, notifs)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-muted"
      >
        <Bell className="h-5 w-5" />
        <CountBadge count={notifs} />
      </Link>
    </>
  );
}
