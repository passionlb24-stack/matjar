"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Minus, Plus, Send } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { Button, ButtonLink } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/notify";

// Public table-reservation form for the food sector. A reservation is an ordinary
// booking with a party size, so it lands in the store's existing bookings inbox.
// Self-contained: resolves the signed-in customer on the client, no server change.
export function ReservationForm({
  storeId,
  lang,
  dict,
}: {
  storeId: string;
  lang: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const t = dict.reservations;
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("20:00");
  const [party, setParty] = useState(2);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUid(user.id);
        setName(
          (user.user_metadata?.full_name as string | undefined) ??
            user.email ??
            "",
        );
      }
      setReady(true);
    })();
  }, []);

  async function submit() {
    if (!date || party < 1 || phone.trim().length < 4 || busy || !uid) return;
    setBusy(true);
    const { error } = await createClient().from("bookings").insert({
      store_id: storeId,
      customer_id: uid,
      service_name: t.serviceName,
      requested_date: date,
      requested_time: time,
      party_size: party,
      customer_name: name.trim() || null,
      phone: phone.trim(),
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) {
      notifyError(dict.common.actionFailed);
      return;
    }
    notifySuccess(t.sent);
    setNotes("");
    router.refresh();
  }

  if (!ready) return null;

  return (
    <div className="mt-10 rounded-2xl border border-primary/30 bg-primary-soft/30 p-5">
      <h3 className="flex items-center gap-2 text-lg font-extrabold">
        <CalendarClock className="h-5 w-5 text-primary" />
        {t.title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>

      {uid ? (
        <div className="mt-4 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">{t.date}</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">{t.time}</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2">
            <span className="text-sm font-semibold">{t.partySize}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setParty((p) => Math.max(1, p - 1))}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
                disabled={party <= 1}
                aria-label={t.fewer}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-base font-bold tabular-nums">
                {party}
              </span>
              <button
                type="button"
                onClick={() => setParty((p) => Math.min(50, p + 1))}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted"
                aria-label={t.more}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.phone}
            inputMode="tel"
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.notesHint}
            rows={2}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <Button
            onClick={submit}
            loading={busy}
            disabled={!date || phone.trim().length < 4}
            leftIcon={<Send className="h-4 w-4" />}
          >
            {t.book}
          </Button>
        </div>
      ) : (
        <ButtonLink href={`/${lang}/login`} className="mt-4">
          {t.loginToBook}
        </ButtonLink>
      )}
    </div>
  );
}
