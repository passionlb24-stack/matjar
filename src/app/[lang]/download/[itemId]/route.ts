import { createClient } from "@/lib/supabase/server";
import { adminClientIfConfigured } from "@/lib/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How long a minted link stays good. Long enough to click, short enough that
 *  a shared or logged URL is worthless by the time anyone else tries it. */
const LINK_TTL_SECONDS = 300;

// Download for a purchased digital product.
//
// Two steps, in this order, and the order is the point:
//
//   1. digital_download_grant() runs as the CALLER. It decides entitlement from
//      the order — right buyer, order not pending or cancelled — and returns the
//      storage path only if all of that holds. A stranger, or the buyer of a
//      different order, gets nothing back.
//   2. Only then does the service-role client sign a short-lived URL. The bucket
//      is private and has no read policy, so this is the single way a file
//      leaves it.
//
// Nothing about the file is guessable from outside: the caller passes an
// order_item id, never a path, and the path is never returned to the browser.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ lang: string; itemId: string }> },
) {
  const { itemId } = await params;
  if (!UUID_RE.test(itemId)) {
    return new Response("Not found", { status: 404 });
  }

  // Guests have no account to match on, so they identify with the phone they
  // ordered with — the same handle the order-tracking page uses.
  const phone = new URL(request.url).searchParams.get("phone");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("digital_download_grant", {
    p_order_item_id: itemId,
    p_phone: phone,
  });

  const grant = (data ?? [])[0] as
    | { path: string; filename: string }
    | undefined;

  // One answer for "no such item", "not yours" and "not released yet". Telling
  // them apart would confirm which orders and files exist to someone guessing.
  if (error || !grant) {
    return new Response("Not found", { status: 404 });
  }

  // Entitlement is already proven above, so a missing service key is a
  // deployment fault rather than a refusal. Answering "Not found" here would
  // tell a paying customer their file is gone.
  const admin = adminClientIfConfigured();
  if (!admin) {
    return new Response("Downloads are not configured on this server", {
      status: 503,
    });
  }

  const { data: signed, error: signError } = await admin.storage
    .from("digital-goods")
    .createSignedUrl(grant.path, LINK_TTL_SECONDS, {
      download: grant.filename,
    });

  if (signError || !signed?.signedUrl) {
    return new Response("Not found", { status: 404 });
  }

  return Response.redirect(signed.signedUrl, 302);
}
