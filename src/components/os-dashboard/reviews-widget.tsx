"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Star } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { notifyError, notifySuccess } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { WidgetCard } from "./widget-card";

// ===== OS dashboard — ReviewsWidget =====
// The merchant's side of 0276: the reviews their customers left, and a box to
// answer them in. A shop that can only stay silent or beg an admin to delete a
// bad review has no way to show how it behaves when something goes wrong.
//
// The write is a plain `update` setting `reply` and nothing else — reply_at and
// reply_by are stamped by the database trigger, and blanking `reply` clears the
// answer and its timestamp. Sending either column from here would be ignored at
// best and a lie at worst.

export type MerchantReview = {
  id: string;
  customer_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
  reply: string | null;
  reply_at: string | null;
};

export function ReviewsWidget({
  reviews,
  canReply,
  dict,
  lang,
}: {
  reviews: MerchantReview[];
  /**
   * Only the owner passes the reply policy (is_store_owner, not
   * can_manage_store). Staff get the reviews read-only rather than a save
   * button whose update would match zero rows and fail silently.
   */
  canReply: boolean;
  dict: Pick<Dictionary, "reviews" | "common">;
  lang: string;
}) {
  return (
    <WidgetCard title={dict.reviews.merchantTitle} Icon={Star}>
      {reviews.length ? (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id}>
              <ReviewRow
                review={r}
                canReply={canReply}
                dict={dict}
                lang={lang}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm font-medium text-muted-foreground">
          {dict.reviews.merchantEmpty}
        </p>
      )}
    </WidgetCard>
  );
}

function ReviewRow({
  review,
  canReply,
  dict,
  lang,
}: {
  review: MerchantReview;
  canReply: boolean;
  dict: Pick<Dictionary, "reviews" | "common">;
  lang: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(review.reply ?? "");
  const [busy, setBusy] = useState(false);
  const hasReply = !!review.reply?.trim();

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "ar" ? "ar" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  async function save(text: string) {
    setBusy(true);
    // .select() back: RLS denies the row rather than erroring, so an update that
    // touched nothing returns an empty set with error === null. Without this the
    // UI would report success for a write that never happened.
    const { data, error } = await createClient()
      .from("reviews")
      .update({ reply: text })
      .eq("id", review.id)
      .select("id");
    setBusy(false);
    if (error || !data?.length) {
      notifyError(dict.reviews.replyError);
      return;
    }
    notifySuccess(
      text.trim() ? dict.reviews.replySaved : dict.reviews.replyRemoved,
    );
    // The trigger stores the trimmed text (blank → null), so mirror that here:
    // reopening the box has to show what the database actually holds, not the
    // draft the merchant happened to type.
    setDraft(text.trim());
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl bg-surface-muted/60 p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`h-3.5 w-3.5 ${
                review.rating >= n
                  ? "fill-accent text-accent"
                  : "text-border"
              }`}
            />
          ))}
        </span>
        <span dir="auto" className="min-w-0 truncate text-sm font-bold">
          {review.customer_name ?? "—"}
        </span>
        <time
          dateTime={review.created_at}
          dir="ltr"
          className="ms-auto shrink-0 text-xs tabular-nums text-muted-foreground"
        >
          {fmtDate(review.created_at)}
        </time>
      </div>

      {review.comment && (
        <p className="mt-1.5 text-sm text-muted-foreground">{review.comment}</p>
      )}

      {hasReply && !open && (
        <div className="mt-2 border-s-2 border-primary/40 ps-2.5">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="text-xs font-bold text-primary">
              {dict.reviews.replyFrom}
            </span>
            {review.reply_at && (
              <time
                dateTime={review.reply_at}
                dir="ltr"
                className="text-xs tabular-nums text-muted-foreground"
              >
                {fmtDate(review.reply_at)}
              </time>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{review.reply}</p>
        </div>
      )}

      {canReply &&
        (open ? (
          <div className="mt-2.5">
            <label className="sr-only" htmlFor={`reply-${review.id}`}>
              {dict.reviews.reply}
            </label>
            <textarea
              id={`reply-${review.id}`}
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={dict.reviews.replyPlaceholder}
              className="min-h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void save(draft)}
                loading={busy}
                disabled={draft.trim() === (review.reply ?? "").trim()}
              >
                {busy ? dict.reviews.replySaving : dict.reviews.replySave}
              </Button>
              {hasReply && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void save("")}
                  disabled={busy}
                  className="!text-danger"
                >
                  {dict.reviews.replyRemove}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(review.reply ?? "");
                  setOpen(false);
                }}
                disabled={busy}
              >
                {dict.common.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-primary transition-colors hover:bg-primary-soft/60 lg:min-h-0 lg:py-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {hasReply ? dict.reviews.replyEdit : dict.reviews.reply}
          </button>
        ))}
    </div>
  );
}
