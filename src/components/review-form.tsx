"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/get-dictionary";

export function ReviewForm({
  storeId,
  dict,
  customerName,
  initialRating,
  initialComment,
}: {
  storeId: string;
  dict: Dictionary;
  customerName: string;
  initialRating?: number;
  initialComment?: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(initialRating ?? 0);
  const [hover, setHover] = useState(0);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (rating < 1) return;
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    await supabase.from("reviews").upsert(
      {
        store_id: storeId,
        customer_id: user.id,
        customer_name: customerName,
        rating,
        comment: String(form.get("comment")) || null,
      },
      { onConflict: "store_id,customer_id" },
    );
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="font-bold">{dict.reviews.leaveReview}</h3>
      <div className="mt-3">
        <span className="text-sm font-semibold">{dict.reviews.yourRating}</span>
        <div className="mt-1.5 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              aria-label={`${n}`}
            >
              <Star
                className={`h-7 w-7 transition-colors ${
                  (hover || rating) >= n
                    ? "fill-amber-400 text-amber-400"
                    : "text-border"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
      <textarea
        name="comment"
        rows={2}
        defaultValue={initialComment}
        placeholder={dict.reviews.commentPlaceholder}
        className="mt-3 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        disabled={loading || rating < 1}
        className="mt-3 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {loading ? dict.reviews.submitting : dict.reviews.submit}
      </button>
    </form>
  );
}
