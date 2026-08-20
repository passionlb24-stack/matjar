"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { GalleryUpload } from "@/components/gallery-upload";
import { fieldClass } from "@/components/ui/field";

const field = `${fieldClass} mt-1.5`;
const label = "text-sm font-semibold";

// "I need someone to look at this."
//
// Five questions, none of them optional-feeling, because every one is
// something the tradesman needs before he can decide whether to call back.
// Deliberately not an order form: nothing is priced or committed here — it is
// a message with structure, which is what this market actually runs on.
//
// A signed-in customer never retypes their phone if we already have it, and
// their request files under their account so it can be reviewed later. A guest
// can still ask; that is most of this market and blocking it would be the
// single biggest way to lose requests.
export function CraftRequestForm({
  providerId,
  providerName,
  lang,
  userId,
  defaultName,
  defaultPhone,
  areas,
  labels,
}: {
  providerId: string;
  providerName: string;
  lang: string;
  userId: string | null;
  defaultName: string;
  defaultPhone: string;
  areas: { id: string; name_ar: string; name_en: string; region: string }[];
  labels: {
    what: string;
    whatPlaceholder: string;
    where: string;
    address: string;
    when: string;
    whenOptions: Record<string, string>;
    name: string;
    phone: string;
    photos: string;
    photosHint: string;
    photosGuest: string;
    submit: string;
    sending: string;
    sentTitle: string;
    sentBody: string;
    backToProfile: string;
    error: string;
    regions: Record<string, string>;
  };
}) {
  const router = useRouter();
  const ar = lang === "ar";
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // MJ-016. `craft_requests.photos` has existed since 0239 and nothing has
  // ever written to it. For a trade this is the single highest-value answer
  // after the description: a photo of the leak decides whether the job is a
  // washer or a morning, which is the call the tradesman would otherwise make.
  const [photos, setPhotos] = useState<string[]>([]);

  const byRegion = areas.reduce<Record<string, typeof areas>>((acc, a) => {
    (acc[a.region] ??= []).push(a);
    return acc;
  }, {});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    const { error: insertError } = await createClient()
      .from("craft_requests")
      .insert({
        provider_id: providerId,
        // Null for a guest — the RLS policy allows exactly that and nothing
        // else, so a request can never be filed under someone else's account.
        customer_id: userId,
        customer_name: String(form.get("name") ?? "").trim() || null,
        phone: String(form.get("phone") ?? "").trim(),
        description: String(form.get("what") ?? "").trim(),
        area_id: String(form.get("area") ?? "") || null,
        address: String(form.get("address") ?? "").trim() || null,
        when_pref: String(form.get("when") ?? "") || null,
        // Guests never have any (the storage insert policy is `to
        // authenticated`), so this is [] for them — the column's own default.
        photos,
      });

    setBusy(false);
    if (insertError) {
      setError(labels.error);
      return;
    }
    setSent(true);
    router.refresh();
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success-soft p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <p className="mt-3 text-lg font-extrabold">{labels.sentTitle}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {labels.sentBody.replace("{name}", providerName)}
        </p>
        <a
          href={`/${lang}/crafts/p/${providerId}`}
          className="mt-4 inline-block rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-bold transition-colors hover:border-primary hover:text-primary"
        >
          {labels.backToProfile}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className={label} htmlFor="what">
          {labels.what}
        </label>
        <textarea
          id="what"
          name="what"
          rows={4}
          required
          placeholder={labels.whatPlaceholder}
          className={field}
        />
      </div>

      {/* Right under the description, because it is the same answer in a
          different medium — "here, look". Signed-in only: `store-assets`
          accepts inserts from `authenticated` alone, and widening that policy
          to let anonymous visitors write into a public bucket is not a trade
          worth making for a convenience. A guest is told once and can still
          send the request. */}
      {userId ? (
        <div>
          <GalleryUpload
            folder={`crafts/${userId}/requests`}
            value={photos}
            onChange={setPhotos}
            label={labels.photos}
            max={3}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {labels.photosHint}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{labels.photosGuest}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="area">
            {labels.where}
          </label>
          <select id="area" name="area" className={field}>
            <option value="">—</option>
            {Object.entries(byRegion).map(([region, list]) => (
              <optgroup key={region} label={labels.regions[region] ?? region}>
                {list.map((a) => (
                  <option key={a.id} value={a.id}>
                    {ar ? a.name_ar : a.name_en}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="address">
            {labels.address}
          </label>
          <input id="address" name="address" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="when">
            {labels.when}
          </label>
          <select id="when" name="when" className={field} defaultValue="flexible">
            {Object.entries(labels.whenOptions).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="name">
            {labels.name}
          </label>
          <input
            id="name"
            name="name"
            defaultValue={defaultName}
            className={field}
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="phone">
          {labels.phone}
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          dir="ltr"
          required
          defaultValue={defaultPhone}
          className={field}
        />
      </div>

      {error && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      <Button type="submit" loading={busy} className="w-full sm:w-auto">
        {busy ? labels.sending : labels.submit}
      </Button>
    </form>
  );
}
