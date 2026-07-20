"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Send } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { Button, ButtonLink } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/notify";

type MyRequest = {
  id: string;
  status: string;
  description: string;
  quote_amount: number | null;
  quote_note: string | null;
};

function money(n: number) {
  return n >= 1000 ? `$${Number(n).toLocaleString("en-US")}` : `$${n}`;
}

// Customer-facing quote request for service/clinic stores. Self-contained: it
// resolves the signed-in user and their existing requests to THIS store on the
// client, so the server store page doesn't need to change.
export function ServiceRequestForm({
  storeId,
  lang,
  dict,
}: {
  storeId: string;
  lang: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const t = dict.os.requestForm;
  const rt = dict.os.requests;
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [mine, setMine] = useState<MyRequest[]>([]);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
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
        const { data } = await supabase
          .from("service_requests")
          .select("id, status, description, quote_amount, quote_note")
          .eq("store_id", storeId)
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false });
        setMine((data ?? []) as MyRequest[]);
      }
      setReady(true);
    })();
  }, [storeId]);

  async function submit() {
    if (!description.trim() || phone.trim().length < 4 || busy || !uid) return;
    setBusy(true);
    const desc = description.trim();
    // Return the real row so the optimistic entry carries its DB id (needed for
    // an immediate cancel — a fabricated id would miss on the RPC).
    const { data: created, error } = await createClient()
      .from("service_requests")
      .insert({
        store_id: storeId,
        customer_id: uid,
        customer_name: name.trim() || null,
        phone: phone.trim(),
        address: address.trim() || null,
        description: desc,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !created) {
      notifyError(dict.common.actionFailed);
      return;
    }
    notifySuccess(t.sent);
    setDescription("");
    setAddress("");
    router.refresh();
    // Reflect the new request locally with its real id.
    setMine((m) => [
      {
        id: (created as { id: string }).id,
        status: "pending",
        description: desc,
        quote_amount: null,
        quote_note: null,
      },
      ...m,
    ]);
  }

  async function act(id: string, action: "accept" | "cancel") {
    if (action === "cancel" && !window.confirm(t.confirmCancel)) return;
    const { error } = await createClient().rpc("manage_service_request", {
      p_id: id,
      p_action: action,
      p_amount: null,
      p_note: null,
    });
    if (error) {
      notifyError(dict.common.actionFailed);
      return;
    }
    router.refresh();
    setMine((m) =>
      m.map((r) =>
        r.id === id
          ? { ...r, status: action === "accept" ? "accepted" : "cancelled" }
          : r,
      ),
    );
  }

  if (!ready) return null;

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary-soft/30 p-5">
      <h3 className="flex items-center gap-2 text-lg font-extrabold">
        <FileText className="h-5 w-5 text-primary" />
        {t.title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>

      {uid ? (
        <>
          <div className="mt-4 grid gap-2">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.describeHint}
              rows={2}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t.address}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t.phone}
                inputMode="tel"
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <Button
              onClick={submit}
              loading={busy}
              disabled={!description.trim() || phone.trim().length < 4}
              leftIcon={<Send className="h-4 w-4" />}
            >
              {t.send}
            </Button>
          </div>

          {mine.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2 text-sm font-bold">{t.myRequests}</p>
              <ul className="space-y-2">
                {mine.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl border border-border bg-surface p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-muted-foreground">
                        {r.description}
                      </span>
                      <span className="shrink-0 text-xs font-bold">
                        {rt.status[r.status as keyof typeof rt.status]}
                      </span>
                    </div>
                    {r.quote_amount != null && (
                      <p className="mt-1 font-bold text-sky-700">
                        {rt.quotedAt}: {money(Number(r.quote_amount))}
                        {r.quote_note ? (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · {r.quote_note}
                          </span>
                        ) : null}
                      </p>
                    )}
                    {(r.status === "quoted" ||
                      r.status === "pending" ||
                      r.status === "accepted") && (
                      <div className="mt-2 flex gap-2">
                        {r.status === "quoted" && (
                          <button
                            onClick={() => act(r.id, "accept")}
                            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            {t.accept}
                          </button>
                        )}
                        <button
                          onClick={() => act(r.id, "cancel")}
                          className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          {t.cancel}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <ButtonLink href={`/${lang}/login`} className="mt-4">
          {t.loginToRequest}
        </ButtonLink>
      )}
    </div>
  );
}
