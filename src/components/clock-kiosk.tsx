"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";

export type RosterEntry = {
  id: string;
  name: string;
  job_title: string | null;
  on_shift: boolean;
};

// The tablet on the counter.
//
// Big names, a number pad, nothing else. Whoever is standing here has flour on
// their hands and thirty seconds — every extra field is a reason to stop using
// it and go back to the notebook.
//
// The PIN is verified server-side whoever is signed in on the device (0256), so
// tapping someone else's name gets you nowhere without their number. Location is
// attached when the browser offers it and simply skipped when it does not; a
// refused permission must not be a reason someone cannot start work.
export function ClockKiosk({
  storeId,
  roster,
  labels,
}: {
  storeId: string;
  roster: RosterEntry[];
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<RosterEntry | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function coords(): Promise<{ lat: number; lng: number } | null> {
    if (typeof navigator === "undefined" || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      const done = (v: { lat: number; lng: number } | null) => resolve(v);
      navigator.geolocation.getCurrentPosition(
        (p) => done({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => done(null),
        { timeout: 4000, maximumAge: 60_000 },
      );
    });
  }

  async function go() {
    if (!picked || pin.length < 4) return;
    setBusy(true);
    setMsg(null);
    const where = await coords();
    const { data, error } = await createClient().rpc("employee_clock", {
      p_store_id: storeId,
      p_employee_id: picked.id,
      p_pin: pin,
      p_lat: where?.lat ?? null,
      p_lng: where?.lng ?? null,
    });
    setBusy(false);
    setPin("");
    if (error) {
      setMsg({ ok: false, text: labels.kioskBad });
      return;
    }
    const action = (data as { action?: string } | null)?.action;
    setMsg({
      ok: true,
      text: action === "out" ? labels.kioskOut : labels.kioskIn,
    });
    setPicked(null);
    router.refresh();
  }

  if (roster.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
        {labels.kioskEmpty}
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h1 className="flex items-center justify-center gap-2 text-2xl font-extrabold">
        <Clock className="h-6 w-6 text-primary" />
        {labels.kioskTitle}
      </h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        {labels.kioskBody}
      </p>

      {msg && (
        <p
          className={`mt-4 rounded-xl px-4 py-3 text-center font-bold ${
            msg.ok
              ? "bg-success-soft text-success"
              : "bg-danger-soft text-danger"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {roster.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => {
              setPicked(e);
              setPin("");
              setMsg(null);
            }}
            className={`rounded-2xl border p-4 text-center transition-colors ${
              picked?.id === e.id
                ? "border-primary bg-primary-soft"
                : "border-border hover:border-primary/40"
            }`}
          >
            <span className="block font-bold">{e.name}</span>
            {e.job_title && (
              <span className="block text-xs text-muted-foreground">
                {e.job_title}
              </span>
            )}
            <span
              className={`mt-1 inline-flex items-center gap-1 text-xs font-bold ${
                e.on_shift ? "text-success" : "text-muted-foreground"
              }`}
            >
              {e.on_shift ? (
                <LogOut className="h-3 w-3" />
              ) : (
                <LogIn className="h-3 w-3" />
              )}
              {e.on_shift ? labels.clockOut : labels.clockIn}
            </span>
          </button>
        ))}
      </div>

      {picked && (
        <div className="mt-5 flex flex-wrap items-end justify-center gap-2">
          <div>
            <label className="text-sm font-semibold" htmlFor="kiosk_pin">
              {labels.kioskPin} — {picked.name}
            </label>
            <input
              id="kiosk_pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") void go();
              }}
              className={`${fieldClass} mt-1.5 max-w-40 text-center text-2xl tracking-[0.4em]`}
              dir="ltr"
              autoFocus
            />
          </div>
          <Button onClick={go} loading={busy} disabled={pin.length < 4}>
            {labels.kioskGo}
          </Button>
        </div>
      )}
    </div>
  );
}
