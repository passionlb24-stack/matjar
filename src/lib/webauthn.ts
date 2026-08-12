import "server-only";
import { headers } from "next/headers";

// Where the browser thinks it is, from the browser's own point of view.
//
// WebAuthn signs the origin into the assertion, so these two have to match what
// the phone actually loaded or every signature is rejected. Deriving them from
// the request rather than an env var means the same code works on localhost, on
// a Vercel preview, and on matjarlb.com without a config step nobody would
// remember to do.
export async function rpFromRequest(): Promise<{
  rpID: string;
  origin: string;
}> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  // rpID is the domain with no port; origin keeps it.
  return { rpID: host.split(":")[0], origin: `${proto}://${host}` };
}
