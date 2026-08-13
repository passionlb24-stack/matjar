import { NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { adminClientIfConfigured } from "@/lib/supabase/admin";
import { rpFromRequest } from "@/lib/webauthn";

// The punch.
//
// The phone proves, with a signature its own fingerprint unlocked, that it is
// the device registered to this person. The coordinates it sends are checked
// against the shop's pin in the database, not here — a client that decides for
// itself whether it is close enough is a client that can lie about it.
//
// No employee id is ever sent by the browser. The credential identifies the
// person, so there is nothing to tamper with and no roster to leak.

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    step?: string;
    shortCode?: string;
    response?: AuthenticationResponseJSON;
    lat?: number;
    lng?: number;
    /** "in" | "out" | "break_start" | "break_end" | "status". Absent keeps the
     *  old toggle. The database is the authority on whether it is allowed. */
    action?: string;
  } | null;
  if (!body?.shortCode) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // See the register route: an empty 500 here reads to the employee as "your
  // fingerprint failed", which is the one thing it is not.
  const admin = adminClientIfConfigured();
  if (!admin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const { rpID, origin } = await rpFromRequest();

  const { data: ctx } = await admin.rpc("clock_store_context", {
    p_short_code: body.shortCode,
  });
  const store = ctx as { store_id: string; has_location: boolean } | null;
  if (!store) {
    return NextResponse.json({ error: "unknown_store" }, { status: 404 });
  }

  if (body.step === "options") {
    // No allowCredentials list: the phone offers whichever of its own
    // credentials matches this site, which also means we never tell a caller
    // which devices are registered here.
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
    });
    await admin.rpc("issue_webauthn_challenge", {
      p_store_id: store.store_id,
      p_purpose: "authenticate",
      p_challenge: options.challenge,
      p_employee_id: null,
    });
    return NextResponse.json({ options });
  }

  if (body.step === "verify" && body.response) {
    const challenge = JSON.parse(
      Buffer.from(body.response.response.clientDataJSON, "base64url").toString(),
    ).challenge as string;

    const { error: chErr } = await admin.rpc("spend_webauthn_challenge", {
      p_challenge: challenge,
      p_purpose: "authenticate",
    });
    if (chErr) {
      return NextResponse.json({ error: "bad_challenge" }, { status: 400 });
    }

    const { data: devRow } = await admin
      .from("employee_devices")
      .select("credential_id, public_key, counter, store_id, employee_id")
      .eq("credential_id", body.response.id)
      .maybeSingle();
    const dev = devRow as {
      credential_id: string;
      public_key: string;
      counter: number;
      store_id: string;
      employee_id: string;
    } | null;
    // A device registered at another shop must not clock in here.
    if (!dev || dev.store_id !== store.store_id) {
      return NextResponse.json({ error: "device_not_registered" }, { status: 400 });
    }

    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: dev.credential_id,
        publicKey: new Uint8Array(Buffer.from(dev.public_key, "base64url")),
        counter: Number(dev.counter),
      },
    });
    if (!verification.verified) {
      return NextResponse.json({ error: "not_verified" }, { status: 400 });
    }

    // Counters catch a cloned authenticator. Many platform authenticators
    // legitimately always report 0, so this only tightens when the device
    // actually keeps a count.
    const newCounter = verification.authenticationInfo.newCounter;
    if (newCounter > 0) {
      await admin
        .from("employee_devices")
        .update({ counter: newCounter })
        .eq("credential_id", dev.credential_id);
    }

    // "Show me my hours" is the same proof of identity as a punch, minus the
    // punch. The employee has no account, so a biometric assertion is the only
    // thing that can stand for one — and it must not cost them a clock-in to
    // ask a question.
    if (body.action === "status") {
      const { data: snap, error: snapErr } = await admin.rpc(
        "attendance_snapshot",
        { p_employee_id: dev.employee_id },
      );
      if (snapErr) {
        return NextResponse.json({ error: "clock_failed" }, { status: 400 });
      }
      return NextResponse.json({ result: snap });
    }

    const { data, error } = await admin.rpc("clock_by_device", {
      p_credential_id: dev.credential_id,
      p_lat: body.lat ?? null,
      p_lng: body.lng ?? null,
      // Absent means the old toggle. The server still decides whether the
      // action is allowed; this only says what was asked for.
      p_action: body.action ?? null,
    });
    if (error) {
      return NextResponse.json({ error: "clock_failed" }, { status: 400 });
    }
    return NextResponse.json({ result: data });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
