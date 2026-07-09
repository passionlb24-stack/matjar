import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "@/lib/push";

// Admin-only broadcast to every push subscription. Sending needs the private
// VAPID key (VAPID_PRIVATE_KEY env var) — returns 503 until it's configured.
export async function POST(request: Request) {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) {
    return Response.json(
      { error: "push_not_configured" },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "super_admin") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    message?: string;
    url?: string;
  };
  const title = (body.title ?? "").trim() || "متجر";
  const message = (body.message ?? "").trim();
  const url = body.url ?? "/ar";
  if (!message) return Response.json({ error: "empty" }, { status: 400 });

  const { data: subs } = await supabase.rpc("admin_list_push_subscriptions");
  const list = (subs ?? []) as { endpoint: string; p256dh: string; auth: string }[];

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, privateKey);
  const payload = JSON.stringify({ title, body: message, url });

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
        // Dead subscription — ignored (cleanup can come later).
      }
    }),
  );

  return Response.json({ sent, total: list.length });
}
