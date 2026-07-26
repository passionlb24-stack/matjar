import { createClient } from "@/lib/supabase/server";

// Admin broadcast. Historically this ONLY sent Web Push to push_subscriptions —
// a table with zero rows in practice (browser-push permission is rarely
// granted) — so broadcasts reached nobody. It now delivers through the
// guaranteed channel: admin_broadcast_notify (0171) writes an IN-APP
// notification per recipient (all / merchants / customers), and web push rides
// along automatically for any subscriber via the 0049 bridge
// (notifications INSERT → push_on_notification → /api/push/hook).
export async function POST(request: Request) {
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
    audience?: string;
  };
  const message = (body.message ?? "").trim();
  if (!message) return Response.json({ error: "empty" }, { status: 400 });
  const audience = ["all", "merchants", "customers"].includes(
    body.audience ?? "",
  )
    ? (body.audience as string)
    : "all";

  const { data: count, error } = await supabase.rpc("admin_broadcast_notify", {
    p_title: (body.title ?? "").trim() || null,
    p_body: message,
    p_url: (body.url ?? "").trim() || null,
    p_audience: audience,
  });
  if (error) {
    return Response.json({ error: "broadcast_failed" }, { status: 500 });
  }

  return Response.json({ recipients: (count as number | null) ?? 0 });
}
