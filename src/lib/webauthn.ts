import "server-only";
import { headers } from "next/headers";
import { SITE_URL } from "@/lib/site";

// Where the browser thinks it is — checked against a list of hosts we actually
// run on, rather than believed.
//
// WebAuthn signs the origin into the assertion, so the rpID and the expected
// origin have to match what the phone really loaded or every signature is
// rejected. That is why these were read straight off `x-forwarded-host`: one
// codebase, working unchanged on localhost, on a Vercel preview and on the
// production domain.
//
// The problem with reading them is that both headers are attacker-controlled on
// any path that reaches the app without a proxy that overwrites them. A caller
// who can set the host decides the relying-party id the server will accept, and
// an rpID is the whole scope of a credential: it is the answer to "which site
// is this fingerprint for". Nothing downstream re-checks it, so the value the
// request supplied is the value `verifyAuthenticationResponse` is told to trust.
//
// So the header still says which of our hosts this is — it has to, that is the
// only thing that knows — but it may only name a host from this list.

/** Hosts this deployment will accept as the WebAuthn relying party.
 *
 *  Config, not a literal in the source: the canonical site URL (overridable
 *  with NEXT_PUBLIC_SITE_URL), anything named explicitly in
 *  WEBAUTHN_ALLOWED_HOSTS, the platform's own per-deployment hostnames, and
 *  localhost while developing. All of these are SERVER environment — none of
 *  them can be set by whoever is making the request. */
export function allowedWebAuthnHosts(): Set<string> {
  const hosts = new Set<string>();
  const add = (value: string | undefined | null) => {
    if (!value) return;
    // Accept either a bare host or a full URL, so the same env var can hold
    // whichever shape the platform hands over.
    const raw = value.includes("://") ? value.split("://")[1] : value;
    const host = raw.split("/")[0].trim().toLowerCase();
    if (host) hosts.add(host);
  };

  // The canonical public domain. Already the source of truth for canonical
  // URLs, sitemaps and Open Graph, so the clock has no separate notion of
  // "where this site lives".
  add(SITE_URL);
  // Extra hosts a deployment legitimately answers on: an apex/www pair, a
  // staging domain, a long-lived preview. Comma-separated.
  for (const entry of (process.env.WEBAUTHN_ALLOWED_HOSTS ?? "").split(",")) {
    add(entry);
  }
  // Vercel sets these per deployment, in the server environment. They are how a
  // preview keeps working without anybody remembering to configure it — which
  // was the real reason the header was being trusted in the first place.
  add(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  add(process.env.VERCEL_BRANCH_URL);
  add(process.env.VERCEL_URL);

  if (process.env.NODE_ENV !== "production") {
    add("localhost:3000");
    add("127.0.0.1:3000");
  }
  return hosts;
}

/** The relying party for this request, or null if the request claims to be a
 *  host this deployment does not serve.
 *
 *  Null is a refusal, not a fallback. Quietly substituting the canonical host
 *  would hand the phone a challenge for a relying party it is not on, and the
 *  employee would be told their fingerprint failed — which is exactly the
 *  misdiagnosis the clock-in routes already carry a comment about. */
export async function rpFromRequest(): Promise<{
  rpID: string;
  origin: string;
} | null> {
  const h = await headers();
  const raw = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  // A forwarded-host chain lists the original first; the rest are proxies.
  const host = raw.split(",")[0].trim().toLowerCase();
  if (!host) return null;

  const allowed = allowedWebAuthnHosts();
  // Match on host:port, and on the bare host too — a proxy may or may not keep
  // the port, and the allow-list entry may or may not carry one.
  const bare = host.split(":")[0];
  if (!allowed.has(host) && !allowed.has(bare)) return null;

  const proto =
    h.get("x-forwarded-proto") ??
    (bare === "localhost" || bare === "127.0.0.1" ? "http" : "https");
  // rpID is the registrable domain with no port; the origin keeps it.
  return { rpID: bare, origin: `${proto}://${host}` };
}
