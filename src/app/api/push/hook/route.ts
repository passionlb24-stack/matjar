import { timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import { adminClientIfConfigured } from "@/lib/supabase/admin";
import { VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "@/lib/push";

// A `!==` on a secret returns at the first differing byte, so response timing
// leaks how much of a guess was right. timingSafeEqual compares every byte
// regardless. It throws on unequal lengths, so lengths are checked first — that
// comparison only reveals the secret's length, which is not the secret.
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Internal endpoint the DB calls (via pg_net) when a notification is created,
// to fan it out as Web Push. Authenticated by a shared secret header — never
// called by a browser. Needs VAPID_PRIVATE_KEY + PUSH_HOOK_SECRET env vars.
export async function POST(request: Request) {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const hookSecret = process.env.PUSH_HOOK_SECRET;
  if (!privateKey || !hookSecret) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }
  if (!secretMatches(request.headers.get("x-push-secret") ?? "", hookSecret)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    user_id?: string;
    title?: string;
    body?: string;
    url?: string;
  };
  if (!body.user_id) return Response.json({ error: "bad_request" }, { status: 400 });

  // Service role, not the request-scoped client. 0274 revoked get_push_subs from
  // anon and authenticated — it hands back another user's push credentials for
  // any uid, and being callable by a browser was the hole. This endpoint is
  // server-to-server (pg_net → here, secret-header authenticated) and there is
  // no session on the request, so the SSR client was arriving as `anon`: after
  // the revoke it would have silently stopped sending every notification.
  const supabase = adminClientIfConfigured();
  if (!supabase) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }
  // p_secret is deliberately NOT passed (0293). It used to ride along on every
  // push, which put the shared secret into pg_stat_activity, statement logs and
  // error detail lines for no benefit: the function is granted to service_role
  // alone, and the service role can read push_subscriptions directly anyway, so
  // the in-function check could never refuse the only caller able to make it.
  // The secret still authenticates this request — it is just compared above, in
  // this process, against the header, and never leaves it.
  const { data: subs } = await supabase.rpc("get_push_subs", {
    p_uid: body.user_id,
  });
  const list = (subs ?? []) as { endpoint: string; p256dh: string; auth: string }[];
  if (list.length === 0) return Response.json({ sent: 0 });

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, privateKey);
  const payload = JSON.stringify({
    title: body.title ?? "متجر",
    body: body.body ?? "",
    url: body.url ?? "/ar",
  });

  let sent = 0;
  await Promise.all(
    list.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch {
        /* dead subscription — ignore */
      }
    }),
  );

  return Response.json({ sent });
}
