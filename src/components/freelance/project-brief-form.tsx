"use client";

/**
 * "Tell us what you need" — the way out of an empty search.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BACKEND LIMITATION, STATED UP FRONT
 *
 * There is NO project-brief backend on this platform. `craft_requests` exists
 * for the trades — a real table with a status enum, a provider inbox and a
 * lifecycle — and there is no freelance equivalent: no `gig_requests`, no
 * `briefs`, no marketplace-wide job board. Nothing in `supabase/migrations`
 * stores a freelance brief.
 *
 * So this does NOT pretend to be one. What it actually does is exactly what a
 * Lebanese buyer already does by hand: writes the job out once and sends it to
 * someone. It composes the brief into a message and delivers it through the
 * messaging that already exists — `start_conversation(p_other_user)` (0061),
 * then an insert into `messages` under the unchanged `messages_insert` policy
 * (0090: own sender_id, participant, 120/hour). No new table, no new RPC, no
 * RLS change, no money.
 *
 * What that costs, honestly:
 *
 *   - **No status.** A craft request moves pending → accepted → completed. A
 *     brief is a message; it has "read" and nothing else.
 *   - **No broadcast.** It goes to ONE freelancer, chosen here. A brief posted
 *     once and answered by many is a job board, and a job board needs a table.
 *   - **No inbox for the freelancer.** It lands in their normal messages, not
 *     in a requests queue they can triage.
 *   - **No attachments.** `messages.body` is text.
 *
 * All four want the same migration. None of them can be faked in the client,
 * and a UI that implied any of them would be the marketplace lying about what
 * happens after the button is pressed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Privacy (§36)
 *
 * This form asks for no phone number, no email and no address. `craft_requests`
 * requires a phone because a plumber has to physically arrive; freelance work
 * does not, so collecting a contact detail here would be collecting it because
 * the form could, which is the definition of the thing §36 forbids. Region is
 * carried as a region, never an address.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Send, BadgeCheck, Info } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { InitialsAvatar } from "@/components/hub/initials-avatar";

export type BriefRecipient = {
  id: string;
  name: string;
  avatarUrl: string | null;
  verified: boolean;
  /** Already-localised category labels — the client never reads the catalogue. */
  categoryLabels: string[];
};

export function ProjectBriefForm({
  lang,
  dict,
  recipients,
  preselect,
  context,
  signedIn,
}: {
  lang: Locale;
  /** Sliced — a client boundary must not carry the whole 175KB dictionary. */
  dict: Pick<Dictionary, "freelance" | "common">;
  recipients: BriefRecipient[];
  preselect?: string | null;
  /** The filters that produced this shortlist, already localised. */
  context: { categoryLabel?: string | null; regionLabel?: string | null };
  signedIn: boolean;
}) {
  const t = dict.freelance.brief;
  const router = useRouter();

  const [need, setNeed] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [to, setTo] = useState<string>(
    preselect && recipients.some((r) => r.id === preselect)
      ? preselect
      : recipients.length === 1
        ? recipients[0].id
        : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The brief as it will read in the thread.
   *
   * Plain labelled lines rather than a JSON blob or a template with empty
   * slots: the recipient sees a message, and a line only appears when it has
   * something in it — the same "absent is absent" rule the profile obeys.
   */
  function compose(): string {
    const lines = [t.summaryTitle, "", need.trim()];
    const extras: string[] = [];
    if (context.categoryLabel) extras.push(`${t.categoryLine}: ${context.categoryLabel}`);
    const b = Number(budget);
    if (budget.trim() && Number.isFinite(b) && b > 0) {
      extras.push(`${t.budgetLine}: $${b}`);
    }
    if (timeline.trim()) extras.push(`${t.timelineLine}: ${timeline.trim()}`);
    if (context.regionLabel) extras.push(`${t.regionLine}: ${context.regionLabel}`);
    if (extras.length) lines.push("", ...extras);
    return lines.join("\n");
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!need.trim()) {
      setError(t.needRequired);
      return;
    }
    if (!to) {
      setError(t.recipientRequired);
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      // Keep the draft out of the URL — a brief can name a client and a budget,
      // and a query string ends up in history, logs and referrers.
      router.push(`/${lang}/login`);
      return;
    }

    const { data: conv, error: convErr } = await supabase.rpc("start_conversation", {
      p_other_user: to,
    });
    if (convErr || !conv) {
      setBusy(false);
      setError(t.failed);
      return;
    }
    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id: conv,
      sender_id: user.id,
      body: compose(),
    });
    if (msgErr) {
      setBusy(false);
      // The insert policy caps messages per hour; a rejection here is the cap.
      setError(dict.common.rateLimited);
      return;
    }
    router.push(`/${lang}/messages/${conv}`);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label={t.needLabel} htmlFor="brief-need" required>
        <Textarea
          id="brief-need"
          rows={5}
          value={need}
          onChange={(e) => setNeed(e.target.value)}
          placeholder={t.needPlaceholder}
          maxLength={2000}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.budgetLabel} htmlFor="brief-budget">
          <Input
            id="brief-budget"
            type="number"
            inputMode="decimal"
            min={0}
            step="1"
            dir="ltr"
            className="text-money"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </Field>
        <Field label={t.timelineLabel} htmlFor="brief-timeline">
          <Input
            id="brief-timeline"
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
            placeholder={t.timelinePlaceholder}
            maxLength={120}
          />
        </Field>
      </div>

      {/* Who it goes to. A radio list, not a dropdown: with a handful of
          freelancers the choice IS the decision, and hiding it behind a select
          makes the platform look like it picked for you. */}
      <Field label={t.recipientLabel} group required>
        {recipients.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t.noRecipients}
          </p>
        ) : (
          <div className="space-y-2">
            {recipients.map((r) => (
              <label
                key={r.id}
                className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                  to === r.id
                    ? "border-primary bg-primary-soft/40"
                    : "border-border-strong hover:border-primary/40"
                }`}
              >
                <input
                  type="radio"
                  name="brief-to"
                  value={r.id}
                  checked={to === r.id}
                  onChange={() => setTo(r.id)}
                  className="h-5 w-5 shrink-0 accent-[var(--primary)]"
                />
                {r.avatarUrl ? (
                  <Image
                    src={r.avatarUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <InitialsAvatar name={r.name} size="sm" className="!h-10 !w-10 !text-xs" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-bold">
                    <span className="truncate">{r.name}</span>
                    {r.verified && (
                      <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    )}
                  </span>
                  {r.categoryLabels.length > 0 && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.categoryLabels.join(lang === "ar" ? "، " : ", ")}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
      </Field>

      {/* What actually happens when they press send. Said before the press,
          because the honest version of this flow is only honest if the buyer
          knows it is a message and not a ticket. */}
      <p className="flex items-start gap-2 rounded-xl bg-surface-muted p-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {t.deliveryNote}
      </p>

      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      <Button
        type="submit"
        full
        loading={busy}
        leftIcon={<Send className="h-4 w-4" />}
        disabled={recipients.length === 0}
      >
        {busy ? t.sending : signedIn ? t.send : dict.common.login}
      </Button>
    </form>
  );
}
