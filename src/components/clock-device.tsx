"use client";

import { useState, useSyncExternalStore } from "react";
import { Fingerprint, Loader2, MapPin, ShieldCheck } from "lucide-react";
import {
  startAuthentication,
  startRegistration,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";

type Msg = { ok: boolean; text: string } | null;

// Neither value changes without a full reload, so there is nothing to subscribe
// to; the hook still wants a subscribe function.
const subscribeNothing = () => () => {};

// What the employee opens on their own phone.
//
// One screen, one button. They reach it by a short link the owner puts on a
// sticker by the door — no account, no UUID, nothing to type after the first
// day. The first visit asks for a six-digit code the owner reads out; every
// visit after that is a fingerprint and nothing else.
export function ClockDevice({
  shortCode,
  storeName,
  hasLocation,
  labels,
}: {
  shortCode: string;
  storeName: string;
  hasLocation: boolean;
  labels: Record<string, string>;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  // Set after linking or after choosing "not my phone"; null means "whatever the
  // phone itself says".
  const [override, setOverride] = useState<boolean | null>(null);

  // Both of these are facts about the device, read through the external-store
  // hook rather than an effect: the server has no window, and setting state
  // straight out of an effect is the cascading-render pattern React 19 rejects.
  const supported = useSyncExternalStore(
    subscribeNothing,
    () => browserSupportsWebAuthn(),
    () => null as boolean | null,
  );
  // Whether this phone has already been attached lives on the phone. Losing it
  // costs one extra tap, not a lockout — the punch works regardless, this only
  // decides which screen shows first.
  const storedEnrolled = useSyncExternalStore(
    subscribeNothing,
    () => {
      try {
        return localStorage.getItem(`clock:${shortCode}`) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const enrolled = override ?? storedEnrolled;

  // Refused or unavailable location resolves to null and the server refuses the
  // punch. Silently accepting it is what made the first version pointless.
  async function coords(): Promise<{ lat: number; lng: number } | null> {
    if (typeof navigator === "undefined" || !navigator.geolocation) return null;
    return new Promise((resolve) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
      ),
    );
  }

  async function enrol() {
    if (code.trim().length !== 6) return;
    setBusy(true);
    setMsg(null);
    try {
      const optRes = await fetch("/api/clock/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: "options", shortCode, code: code.trim() }),
      }).then((r) => r.json());
      if (!optRes.options) {
        setMsg({ ok: false, text: labels.badCode });
        return;
      }
      const attestation = await startRegistration({
        optionsJSON: optRes.options,
      });
      const done = await fetch("/api/clock/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: "verify",
          shortCode,
          response: attestation,
          label: navigator.userAgent.slice(0, 60),
        }),
      }).then((r) => r.json());
      if (!done.ok) {
        setMsg({ ok: false, text: labels.enrolFailed });
        return;
      }
      try {
        localStorage.setItem(`clock:${shortCode}`, "1");
      } catch {
        /* nothing to remember on, which is fine */
      }
      setOverride(true);
      setCode("");
      setMsg({ ok: true, text: labels.enrolDone });
    } catch {
      setMsg({ ok: false, text: labels.enrolFailed });
    } finally {
      setBusy(false);
    }
  }

  async function punch() {
    setBusy(true);
    setMsg(null);
    try {
      const where = await coords();
      if (!where) {
        setMsg({ ok: false, text: labels.needLocation });
        return;
      }
      const optRes = await fetch("/api/clock/punch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: "options", shortCode }),
      }).then((r) => r.json());
      if (!optRes.options) {
        setMsg({ ok: false, text: labels.failed });
        return;
      }
      const assertion = await startAuthentication({
        optionsJSON: optRes.options,
      });
      const res = await fetch("/api/clock/punch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: "verify",
          shortCode,
          response: assertion,
          lat: where.lat,
          lng: where.lng,
        }),
      }).then((r) => r.json());

      if (res.error === "device_not_registered") {
        setOverride(false);
        setMsg({ ok: false, text: labels.notRegistered });
        return;
      }
      if (!res.result) {
        setMsg({ ok: false, text: labels.failed });
        return;
      }
      const r = res.result as {
        action: string;
        name?: string;
        meters?: number;
        allowed?: number;
      };
      if (r.action === "too_far") {
        setMsg({
          ok: false,
          text: labels.tooFar
            .replace("{m}", String(r.meters ?? "?"))
            .replace("{a}", String(r.allowed ?? "?")),
        });
        return;
      }
      if (r.action === "no_store_location") {
        setMsg({ ok: false, text: labels.noStorePin });
        return;
      }
      if (r.action === "no_location") {
        setMsg({ ok: false, text: labels.needLocation });
        return;
      }
      setMsg({
        ok: true,
        text: (r.action === "out" ? labels.goodbye : labels.welcome).replace(
          "{n}",
          r.name ?? "",
        ),
      });
    } catch {
      // Cancelling the fingerprint prompt lands here, which is not an error
      // worth shouting about.
      setMsg({ ok: false, text: labels.cancelled });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm rounded-3xl border border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold text-muted-foreground">{storeName}</p>
      <h1 className="mt-1 text-2xl font-extrabold">{labels.title}</h1>

      {msg && (
        <p
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-bold ${
            msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
          }`}
        >
          {msg.text}
        </p>
      )}

      {supported === false ? (
        <p className="mt-6 rounded-2xl bg-warning-soft px-4 py-3 text-sm font-semibold text-warning">
          {labels.noSupport}
        </p>
      ) : !hasLocation ? (
        <p className="mt-6 rounded-2xl bg-warning-soft px-4 py-3 text-sm font-semibold text-warning">
          {labels.noStorePin}
        </p>
      ) : enrolled ? (
        <>
          <button
            type="button"
            onClick={punch}
            disabled={busy}
            className="mx-auto mt-8 flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-14 w-14 animate-spin" />
            ) : (
              <Fingerprint className="h-16 w-16" />
            )}
            <span className="text-sm font-bold">
              {busy ? labels.checking : labels.tap}
            </span>
          </button>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {labels.locationNote}
          </p>
          <button
            type="button"
            onClick={() => setOverride(false)}
            className="mt-3 text-xs font-semibold text-muted-foreground underline"
          >
            {labels.anotherPerson}
          </button>
        </>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted-foreground">{labels.enrolBody}</p>
          <input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="------"
            className={`${fieldClass} mt-4 text-center text-3xl tracking-[0.5em]`}
            dir="ltr"
          />
          <Button
            onClick={enrol}
            loading={busy}
            disabled={code.length !== 6}
            className="mt-4 w-full"
          >
            <ShieldCheck className="h-4 w-4" />
            {labels.enrolGo}
          </Button>
        </>
      )}
    </div>
  );
}
