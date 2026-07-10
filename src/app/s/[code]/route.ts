import { createClient } from "@/lib/supabase/server";

// Short store link: matjarlb.com/s/<8-hex code> -> the store page. Printable on
// a storefront/receipt as a QR target. Excluded from the locale proxy.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const clean = code.replace(/[^0-9a-f]/gi, "").toLowerCase().slice(0, 8);
  const home = new URL("/ar", request.url);
  if (clean.length < 4) return Response.redirect(home, 302);

  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("id")
    .eq("short_code", clean)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return Response.redirect(home, 302);
  return Response.redirect(
    new URL(`/ar/store/${(data as { id: string }).id}`, request.url),
    302,
  );
}
