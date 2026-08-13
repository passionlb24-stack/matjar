import { NextResponse } from "next/server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rpFromRequest } from "@/lib/webauthn";

// Attaching one phone to one person, once.
//
// Everything here runs with the service role because the person on the other end
// has no Matjar account — that is the whole point. What stands in for a login is
// the enrolment code the owner reads out, which is single-use and expires in ten
// minutes, plus the fact that registration then binds to a biometric the phone
// itself holds.

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    step?: string;
    shortCode?: string;
    code?: string;
    response?: RegistrationResponseJSON;
    label?: string;
  } | null;
  if (!body?.shortCode) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { rpID, origin } = await rpFromRequest();

  const { data: ctx } = await admin.rpc("clock_store_context", {
    p_short_code: body.shortCode,
  });
  const store = ctx as { store_id: string; name: string } | null;
  if (!store) {
    return NextResponse.json({ error: "unknown_store" }, { status: 404 });
  }

  // --- Step 1: the code is spent, and we hand back a challenge -------------
  if (body.step === "options") {
    if (!body.code) {
      return NextResponse.json({ error: "bad_code" }, { status: 400 });
    }
    // The code is a six-digit secret on a public endpoint, so the function
    // counts wrong guesses and refuses the shop after five in fifteen minutes.
    //
    // Null still means no, and the signature is deliberately unchanged: 0264
    // widened this to jsonb and broke enrolment in production, because the
    // deployed route was still reading a uuid. The reason for the refusal is
    // asked separately (0265) and only after one — so a caller that never asks
    // keeps working exactly as before.
    const { data: employeeId, error } = await admin.rpc(
      "redeem_enrolment_code",
      { p_store_id: store.store_id, p_code: body.code },
    );
    if (error || !employeeId) {
      // A lockout reported as "wrong code" is an instruction to keep trying,
      // to someone who is holding the correct code.
      const { data: locked } = await admin.rpc("enrolment_locked", {
        p_store_id: store.store_id,
      });
      return NextResponse.json(
        { error: locked ? "locked" : "bad_code" },
        { status: locked ? 429 : 400 },
      );
    }

    const options = await generateRegistrationOptions({
      rpName: store.name,
      rpID,
      userName: String(employeeId),
      // Only the phone's own screen lock counts. A roaming security key would
      // work cryptographically and defeat the purpose: it can be handed over.
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        userVerification: "required",
      },
      attestationType: "none",
    });

    await admin.rpc("issue_webauthn_challenge", {
      p_store_id: store.store_id,
      p_purpose: "register",
      p_challenge: options.challenge,
      p_employee_id: employeeId,
    });

    return NextResponse.json({ options });
  }

  // --- Step 2: verify what the phone signed and store the public key -------
  if (body.step === "verify" && body.response) {
    const challenge = JSON.parse(
      Buffer.from(body.response.response.clientDataJSON, "base64url").toString(),
    ).challenge as string;

    const { data: employeeId, error: chErr } = await admin.rpc(
      "spend_webauthn_challenge",
      { p_challenge: challenge, p_purpose: "register" },
    );
    if (chErr || !employeeId) {
      return NextResponse.json({ error: "bad_challenge" }, { status: 400 });
    }

    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "not_verified" }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;
    const { error } = await admin.rpc("register_employee_device", {
      p_employee_id: employeeId,
      p_credential_id: credential.id,
      p_public_key: Buffer.from(credential.publicKey).toString("base64url"),
      p_counter: credential.counter,
      p_label: body.label?.slice(0, 60) ?? null,
    });
    if (error) {
      return NextResponse.json({ error: "save_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
