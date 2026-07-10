import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "@/lib/push";

// Internal endpoint the DB calls (via pg_net) when a notification is created,
// to fan it out as Web Push. Authenticated by a shared secret header — never
// called by a browser. Needs VAPID_PRIVATE_KEY + PUSH_HOOK_SECRET env vars.
export async function POST(request: Request) {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const hookSecret = process.env.PUSH_HOOK_SECRET;
  if (!privateKey || !hookSecret) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }
  if (request.headers.get("x-push-secret") !== hookSecret) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    user_id?: string;
    title?: string;
    body?: string;
    url?: string;
  };
  if (!body.user_id) return Response.json({ error: "bad_request" }, { status: 400 });

  const supabase = await createClient();
  const { data: subs } = await supabase.rpc("get_push_subs", {
    p_uid: body.user_id,
    p_secret: hookSecret,
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
