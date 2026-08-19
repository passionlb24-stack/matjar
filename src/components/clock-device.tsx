"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import {
  Coffee,
  Fingerprint,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  startAuthentication,
  startRegistration,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";

type Msg = { ok: boolean; text: ReactNode } | null;

/** Exactly what the punch route accepts. "status" reads without punching. */
type Ask = "in" | "out" | "break_start" | "break_end" | "status";

/** Whatever is in flight — one at a time, so the right button spins. */
type Busy = Ask | "enrol";

type RecentDay = {
  date: string;
  in: string;
  out: string | null;
  minutes: number;
  auto_closed: boolean;
  edited: boolean;
  /** Null when there is no shift to be late against — which is not "on time". */
  late_minutes: number | null;
};

type Snapshot = {
  state: "in" | "out" | "break";
  since: string | null;
  break_since: string | null;
  today_minutes: number;
  week_minutes: number;
  recent: RecentDay[];
};

/**
 * A punch answers with `action` + the whole snapshot merged in. A refusal
 * (`already_in`, `too_far`, …) answers with `action` and almost nothing else,
 * so every snapshot field has to be treated as optional here.
 */
type PunchResult = Partial<Snapshot> & {
  action?: string;
  name?: string;
  meters?: number;
  allowed?: number;
  at?: string;
};

// Neither value changes without a full reload, so there is nothing to subscribe
// to; the hook still wants a subscribe function.
const subscribeNothing = () => () => {};

/** A refusal carries no `recent`, which is how it is told apart from a punch. */
function isSnapshot(r: PunchResult): boolean {
  return typeof r.state === "string" && Array.isArray(r.recent);
}

function toSnapshot(r: Partial<Snapshot>): Snapshot {
  return {
    state: r.state === "in" || r.state === "break" ? r.state : "out",
    since: r.since ?? null,
    break_since: r.break_since ?? null,
    today_minutes: Number(r.today_minutes ?? 0),
    week_minutes: Number(r.week_minutes ?? 0),
    recent: Array.isArray(r.recent) ? r.recent : [],
  };
}

// The one thing a refusal is certain about is the state that caused it. Adopting
// it stops the screen offering, again, the button that was just refused.
const REFUSED_STATE: Record<string, Snapshot["state"]> = {
  already_in: "in",
  not_in: "out",
  already_break: "break",
  not_break: "in",
};

function afterRefusal(prev: Snapshot | null, r: PunchResult): Snapshot | null {
  const state = REFUSED_STATE[r.action ?? ""];
  // Hours and history are not in a refusal; keeping the previous ones is honest,
  // inventing zeroes is not.
  if (!state || !prev) return prev;
  return {
    ...prev,
    state,
    since: state === "out" ? null : (r.since ?? prev.since),
    break_since: state === "break" ? (r.break_since ?? prev.break_since) : null,
  };
}

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

const pad = (n: number) => String(n).padStart(2, "0");

function elapsed(fromISO: string, atMs: number) {
  const secs = Math.max(0, Math.floor((atMs - Date.parse(fromISO)) / 1000));
  return `${Math.floor(secs / 3600)}:${pad(Math.floor(secs / 60) % 60)}:${pad(secs % 60)}`;
}

// Clock faces are read, not parsed: they must not flinch as the seconds change,
// and they must not be reordered by the Arabic text around them.
function Num({ children }: { children: ReactNode }) {
  return (
    <bdi dir="ltr" className="tabular-nums">
      {children}
    </bdi>
  );
}

/** "تم تسجيل دخولك — {t}" with the time kept in its own bidi island. */
function withTime(template: string, time: string) {
  const [before, after = ""] = template.split("{t}");
  return (
    <>
      {before}
      <Num>{time}</Num>
      {after}
    </>
  );
}

function Chip({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>
      {children}
    </span>
  );
}

// What the employee opens on their own phone.
//
// They reach it by a short link the owner puts on a sticker by the door — no
// account, no UUID, nothing to type after the first day. The first visit asks
// for a six-digit code the owner reads out; every visit after that is a
// fingerprint and nothing else.
//
// The screen answers "where do I stand" before it offers anything to press. The
// version before this one had a single button that flipped whatever state the
// row was in, so the one person who could not tell whether their last tap
// registered — the person standing there — was the one it refused to tell.
export function ClockDevice({
  shortCode,
  storeName,
  hasLocation,
  lang,
  labels,
}: {
  shortCode: string;
  storeName: string;
  hasLocation: boolean;
  lang: string;
  labels: Record<string, string>;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<Busy | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  // Only a punch or a refusal tells us the name — the snapshot has no room for
  // it — so it appears once we have been told and stays.
  const [name, setName] = useState<string | null>(null);
  const [statusDone, setStatusDone] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
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

  // Shop time, not phone time. A handset left on the wrong timezone would
  // otherwise show an hour that disagrees with the payroll sheet, and the
  // employee has no way to know which of the two is lying. Latin digits because
  // the numbers sit in tabular columns and next to Latin durations.
  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Beirut",
      }),
    [lang],
  );
  const dayFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
        weekday: "short",
        day: "numeric",
        month: "numeric",
        timeZone: "Asia/Beirut",
      }),
    [lang],
  );
  const at = useCallback(
    (iso: string | null | undefined) => (iso ? timeFmt.format(new Date(iso)) : "—"),
    [timeFmt],
  );
  const hm = useCallback(
    (mins: number) => {
      const total = Math.max(0, Math.round(Number(mins) || 0));
      return labels.hm
        .replace("{h}", String(Math.floor(total / 60)))
        .replace("{m}", String(total % 60));
    },
    [labels],
  );

  async function enrol() {
    if (code.trim().length !== 6) return;
    setBusy("enrol");
    setMsg(null);
    try {
      const optRes = await fetch("/api/clock/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: "options", shortCode, code: code.trim() }),
      }).then((r) => r.json());
      if (!optRes.options) {
        // "Wrong code" while the shop is locked would have the employee typing
        // the same correct code over and over. Say which one it actually is.
        setMsg({
          ok: false,
          text:
            // `untrusted_host` means the page was reached on a hostname this
            // deployment does not serve as its WebAuthn relying party. That is
            // a server-side setup fault with exactly the shape notConfigured
            // already describes: not the code, not the phone, tell the owner.
            optRes.error === "not_configured" ||
            optRes.error === "untrusted_host"
              ? labels.notConfigured
              : optRes.error === "locked"
                ? labels.enrolLocked
                : labels.badCode,
        });
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
      setBusy(null);
    }
  }

  // Every trip to the server, punch or not, is the same three steps: prove the
  // phone, say what is being asked, read what the database decided.
  const ask = useCallback(
    async (action: Ask) => {
      setBusy(action);
      setMsg(null);
      try {
        // Reading your own hours must not cost a GPS prompt; only a punch is
        // judged on where it was made.
        let where: { lat: number; lng: number } | null = null;
        if (action !== "status") {
          where = await coords();
          if (!where) {
            setMsg({ ok: false, text: labels.needLocation });
            return;
          }
        }

        const optRes = await fetch("/api/clock/punch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ step: "options", shortCode }),
        }).then((r) => r.json());
        if (!optRes.options) {
          // "Something went wrong" would have the employee retrying their
          // fingerprint at a server that is not configured to answer.
          setMsg({
            ok: false,
            text:
              optRes.error === "not_configured" ||
              optRes.error === "untrusted_host"
                ? labels.notConfigured
                : labels.failed,
          });
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
            lat: where?.lat,
            lng: where?.lng,
            action,
          }),
        }).then((r) => r.json());

        // Both mean "this phone is not the one enrolled here": either it was enrolled

        // at another shop, or against another hostname. The employee needs the same

        // thing in both cases — enrol this phone again — so they get the same words.

        if (

          res.error === "device_not_registered" ||

          res.error === "device_other_host"

        ) {
          setOverride(false);
          setSnap(null);
          setMsg({ ok: false, text: labels.notRegistered });
          return;
        }
        if (!res.result) {
          setMsg({
            ok: false,
            text: action === "status" ? labels.statusFailed : labels.failed,
          });
          return;
        }

        const r = res.result as PunchResult;
        if (r.name) setName(r.name);
        if (isSnapshot(r)) {
          setSnap(toSnapshot(r));
          // The elapsed counter is measured against this instant, not against
          // whenever the page happened to open.
          setNowMs(Date.now());
        } else {
          setSnap((prev) => afterRefusal(prev, r));
        }

        // Asking a question is not an event worth announcing; the state block
        // below already shows the answer.
        if (action === "status") return;

        const stamp = at(r.at ?? new Date().toISOString());
        switch (r.action) {
          case "in":
            setMsg({ ok: true, text: withTime(labels.punchedIn, stamp) });
            break;
          case "out":
            setMsg({ ok: true, text: withTime(labels.punchedOut, stamp) });
            break;
          case "break_start":
            setMsg({ ok: true, text: withTime(labels.breakStarted, stamp) });
            break;
          case "break_end":
            setMsg({ ok: true, text: withTime(labels.breakEnded, stamp) });
            break;
          // The rest are refusals, not failures: the punch was understood and
          // declined, and saying so plainly is the whole point of asking for an
          // action instead of toggling.
          case "already_in":
            setMsg({ ok: false, text: withTime(labels.alreadyIn, at(r.since)) });
            break;
          case "not_in":
            setMsg({ ok: false, text: labels.notIn });
            break;
          case "already_break":
            setMsg({
              ok: false,
              text: withTime(labels.alreadyBreak, at(r.break_since)),
            });
            break;
          case "not_break":
            setMsg({ ok: false, text: labels.notBreak });
            break;
          case "too_far":
            setMsg({
              ok: false,
              text: labels.tooFar
                .replace("{m}", String(r.meters ?? "?"))
                .replace("{a}", String(r.allowed ?? "?")),
            });
            break;
          case "no_location":
            setMsg({ ok: false, text: labels.needLocation });
            break;
          case "no_store_location":
            setMsg({ ok: false, text: labels.noStorePin });
            break;
          default:
            setMsg({ ok: false, text: labels.failed });
        }
      } catch {
        // Cancelling the fingerprint prompt lands here, which is not an error
        // worth shouting about.
        setMsg({
          ok: false,
          text: action === "status" ? labels.statusFailed : labels.cancelled,
        });
      } finally {
        setBusy(null);
        if (action === "status") setStatusDone(true);
      }
    },
    [shortCode, labels, at],
  );

  // A phone that arrived already linked can be asked "am I in?" before the
  // employee touches anything — that is the question they came with. A phone
  // that has never enrolled is left alone: an unexplained fingerprint prompt is
  // how people learn to dismiss fingerprint prompts. `storedEnrolled` rather
  // than `enrolled` also keeps a second prompt from landing on the heels of the
  // registration one, which would read as "the linking did not take".
  const autoStatus =
    enrolled && storedEnrolled && supported !== false && hasLocation;
  useEffect(() => {
    if (!autoStatus || statusDone) return;
    // Out of the effect's own run: the first thing `ask` does is set state, and
    // a render triggered from inside a commit is the cascade React 19 rejects.
    const id = setTimeout(() => void ask("status"), 0);
    return () => clearTimeout(id);
  }, [autoStatus, statusDone, ask]);

  // The clock has to move on its own, or the employee cannot tell a live screen
  // from one their phone froze half an hour ago.
  const anchor =
    snap?.state === "break" ? snap.break_since : snap?.state === "in" ? snap.since : null;
  useEffect(() => {
    if (!anchor) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [anchor]);

  const checking = busy === "status" || (autoStatus && !statusDone);
  const working = busy !== null;

  function forget() {
    setOverride(false);
    setSnap(null);
    setName(null);
    setStatusDone(false);
    setMsg(null);
  }

  return (
    <div className="mx-auto max-w-sm rounded-3xl border border-border bg-surface p-6">
      <p className="text-center text-sm font-semibold text-muted-foreground">
        {storeName}
      </p>
      <h1 className="mt-1 text-center text-2xl font-extrabold">{labels.title}</h1>
      {name && (
        <p className="mt-1 text-center text-sm font-bold text-primary">
          {labels.greeting.replace("{n}", name)}
        </p>
      )}

      {/* The receipt. It stays until the next tap replaces it — a toast that
          fades is no proof at all to someone who looked away. */}
      {msg && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-4 rounded-2xl px-4 py-3 text-center text-sm font-bold ${
            msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
          }`}
        >
          {msg.text}
        </p>
      )}

      {supported === false ? (
        <p className="mt-6 rounded-2xl bg-warning-soft px-4 py-3 text-center text-sm font-semibold text-warning">
          {labels.noSupport}
        </p>
      ) : !hasLocation ? (
        <p className="mt-6 rounded-2xl bg-warning-soft px-4 py-3 text-center text-sm font-semibold text-warning">
          {labels.noStorePin}
        </p>
      ) : enrolled ? (
        <>
          <div className="mt-6 rounded-2xl bg-surface-muted px-4 py-5 text-center">
            {snap ? (
              <>
                <p className="text-xl font-extrabold leading-snug">
                  {snap.state === "out"
                    ? labels.stateOut
                    : snap.state === "in"
                      ? withTime(labels.stateIn, at(snap.since))
                      : withTime(labels.stateBreak, at(snap.break_since))}
                </p>
                {anchor && (
                  <p className="mt-2 text-4xl font-black">
                    <Num>{elapsed(anchor, nowMs)}</Num>
                  </p>
                )}
              </>
            ) : (
              <p className="text-lg font-extrabold text-muted-foreground">
                {checking ? labels.stateLoading : labels.stateUnknown}
              </p>
            )}
          </div>

          <div className="mt-5 space-y-3">
            {!snap ? (
              <Button
                full
                size="lg"
                loading={checking}
                disabled={working}
                leftIcon={<RefreshCw className="h-5 w-5" />}
                onClick={() => ask("status")}
              >
                {labels.checkState}
              </Button>
            ) : snap.state === "out" ? (
              <Button
                full
                size="lg"
                loading={busy === "in"}
                disabled={working}
                leftIcon={<Fingerprint className="h-5 w-5" />}
                onClick={() => ask("in")}
              >
                {labels.clockIn}
              </Button>
            ) : snap.state === "in" ? (
              <>
                <Button
                  full
                  size="lg"
                  loading={busy === "out"}
                  disabled={working}
                  leftIcon={<Fingerprint className="h-5 w-5" />}
                  onClick={() => ask("out")}
                >
                  {labels.clockOut}
                </Button>
                <Button
                  full
                  size="lg"
                  variant="secondary"
                  loading={busy === "break_start"}
                  disabled={working}
                  leftIcon={<Coffee className="h-5 w-5" />}
                  onClick={() => ask("break_start")}
                >
                  {labels.breakStart}
                </Button>
              </>
            ) : (
              <>
                <Button
                  full
                  size="lg"
                  loading={busy === "break_end"}
                  disabled={working}
                  leftIcon={<Coffee className="h-5 w-5" />}
                  onClick={() => ask("break_end")}
                >
                  {labels.breakEnd}
                </Button>
                <Button
                  full
                  size="lg"
                  variant="secondary"
                  loading={busy === "out"}
                  disabled={working}
                  leftIcon={<Fingerprint className="h-5 w-5" />}
                  onClick={() => ask("out")}
                >
                  {labels.clockOut}
                </Button>
              </>
            )}
          </div>

          {snap && (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border px-3 py-3 text-center">
                <p className="text-xs font-semibold text-muted-foreground">
                  {labels.todayLabel}
                </p>
                <p className="mt-0.5 text-base font-extrabold tabular-nums">
                  {hm(snap.today_minutes)}
                </p>
              </div>
              <div className="rounded-2xl border border-border px-3 py-3 text-center">
                <p className="text-xs font-semibold text-muted-foreground">
                  {labels.weekLabel}
                </p>
                <p className="mt-0.5 text-base font-extrabold tabular-nums">
                  {hm(snap.week_minutes)}
                </p>
              </div>
            </div>
          )}

          {snap && (
            <div className="mt-6 text-start">
              <h2 className="text-sm font-bold">{labels.recentTitle}</h2>
              {snap.recent.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {labels.recentNone}
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-border">
                  {snap.recent.map((d) => (
                    <li key={d.in} className="py-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-bold">
                          {dayFmt.format(new Date(d.date))}
                        </span>
                        <span className="text-sm font-extrabold tabular-nums">
                          {hm(d.minutes)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {labels.colIn} <Num>{at(d.in)}</Num>
                        </span>
                        <span>
                          {labels.colOut}{" "}
                          {d.out ? <Num>{at(d.out)}</Num> : labels.stillIn}
                        </span>
                      </div>
                      {(d.auto_closed ||
                        d.edited ||
                        (d.late_minutes ?? 0) > 0) && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {/* An end time nobody punched is a guess, and the
                              person it is guessed about should be the first to
                              know. */}
                          {d.auto_closed && (
                            <Chip tone="bg-warning-soft text-warning">
                              {labels.autoClosedNote}
                            </Chip>
                          )}
                          {d.edited && (
                            <Chip tone="bg-surface-muted text-muted-foreground">
                              {labels.editedNote}
                            </Chip>
                          )}
                          {/* Null means the shop set no shift for that day, so
                              there is nothing to be late against — only a real
                              number earns the badge. */}
                          {(d.late_minutes ?? 0) > 0 && (
                            <Chip tone="bg-danger-soft text-danger">
                              {labels.lateBy.replace(
                                "{m}",
                                String(d.late_minutes),
                              )}
                            </Chip>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {labels.locationNote}
          </p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Fingerprint className="h-3.5 w-3.5 shrink-0" />
            {labels.fingerprintNote}
          </p>
          <button
            type="button"
            onClick={forget}
            className="mx-auto mt-2 flex min-h-11 items-center px-3 text-xs font-semibold text-muted-foreground underline"
          >
            {labels.anotherPerson}
          </button>
        </>
      ) : (
        <>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {labels.enrolBody}
          </p>
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
            loading={working}
            disabled={code.length !== 6}
            full
            className="mt-4"
            leftIcon={<ShieldCheck className="h-4 w-4" />}
          >
            {labels.enrolGo}
          </Button>
        </>
      )}
    </div>
  );
}
