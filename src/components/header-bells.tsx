import Link from "next/link";
import { Bell, MessageCircle } from "lucide-react";
import type { Locale } from "@/i18n/config";

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

// Messages + notifications icons with unread badges. Rendered in BOTH the
// marketplace header and the dashboard header so a signed-in user is never
// more than one tap away from either, on any page.
export function HeaderBells({
  lang,
  unreadNotifications,
  unreadMessages,
}: {
  lang: Locale;
  unreadNotifications: number;
  unreadMessages: number;
}) {
  return (
    <>
      <Link
        href={`/${lang}/messages`}
        aria-label="messages"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-muted"
      >
        <MessageCircle className="h-5 w-5" />
        <CountBadge count={unreadMessages} />
      </Link>
      <Link
        href={`/${lang}/notifications`}
        aria-label="notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-muted"
      >
        <Bell className="h-5 w-5" />
        <CountBadge count={unreadNotifications} />
      </Link>
    </>
  );
}
