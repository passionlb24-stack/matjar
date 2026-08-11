"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";

// Rating a job that actually happened.
//
// The RLS policy behind this only accepts a review whose request is completed,
// belongs to this customer, and has no review yet — so this form cannot be the
// place trust is decided, only the place it is expressed. That is deliberate:
// a star rating anyone can leave is a comment box with numbers on it.
//
// Shown on the customer's own request once the tradesman marks it done, which
// is the moment they have an opinion and the last moment they are still
// thinking about it.
export function CraftReviewForm({
  providerId,
  requestId,
  customerId,
  labels,
}: {
  providerId: string;
  requestId: string;
  customerId: string;
  labels: {
    title: string;
    comment: string;
    commentPlaceholder: string;
    submit: string;
    sending: string;
    thanks: string;
    needRating: string;
    error: string;
  };
}) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (rating < 1) {
      notifyError(labels.needRating);
      return;
    }
    setBusy(true);
    const { error } = await createClient().from("craft_reviews").insert({
      provider_id: providerId,
      request_id: requestId,
      customer_id: customerId,
      rating,
      comment: comment.trim() || null,
    });
    setBusy(false);
    if (error) {
      notifyError(labels.error);
      return;
    }
    setDone(true);
    // The provider's rating_avg and rating_count are recomputed by trigger, so
    // the numbers on their profile are already right by the time this returns.
    router.refresh();
  }

  if (done) {
    return (
      <p className="rounded-xl bg-success-soft px-4 py-3 text-sm font-semibold text-success">
        {labels.thanks}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-muted/40 p-4">
      <p className="text-sm font-bold">{labels.title}</p>

      <div className="mt-2 flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            aria-label={String(n)}
            aria-pressed={rating === n}
            className="p-0.5"
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                n <= (hover || rating)
                  ? "fill-current text-warning"
                  : "text-muted-foreground"
              }`}
            />
          </button>
        ))}
      </div>

      <label className="mt-3 block text-sm font-semibold">
        {labels.comment}
      </label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder={labels.commentPlaceholder}
        className={`${fieldClass} mt-1.5`}
      />

      <Button onClick={submit} loading={busy} size="sm" className="mt-3">
        {busy ? labels.sending : labels.submit}
      </Button>
    </div>
  );
}
