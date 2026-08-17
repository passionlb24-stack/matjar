import Link from "next/link";
import { Star, CornerDownLeft } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { ReviewForm } from "@/components/review-form";

export type Review = {
  id: string;
  customer_id: string;
  customer_name: string | null;
  rating: number;
  comment: string | null;
  // The shop's answer (0276). Only the owner can write it, and `reply_at` is
  // stamped by the trigger — so a reply sent three months late can never be
  // dressed up as same-day.
  reply: string | null;
  reply_at: string | null;
};

export function StoreReviews({
  storeId,
  lang,
  dict,
  reviews,
  currentUser,
}: {
  storeId: string;
  lang: Locale;
  dict: Dictionary;
  reviews: Review[];
  currentUser: { id: string; name: string } | null;
}) {
  const mine = currentUser
    ? reviews.find((r) => r.customer_id === currentUser.id)
    : undefined;

  return (
    <div className="mt-12">
      <h2 className="mb-4 text-xl font-bold">{dict.reviews.title}</h2>

      {currentUser ? (
        <ReviewForm
          storeId={storeId}
          dict={dict}
          customerName={currentUser.name}
          initialRating={mine?.rating}
          initialComment={mine?.comment ?? undefined}
        />
      ) : (
        <Link
          href={`/${lang}/login`}
          className="inline-block rounded-xl border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
        >
          {dict.reviews.loginToReview}
        </Link>
      )}

      <div className="mt-6 space-y-4">
        {reviews.length ? (
          reviews.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">{r.customer_name ?? "—"}</span>
                <span className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-4 w-4 ${
                        r.rating >= n
                          ? "fill-amber-400 text-amber-400"
                          : "text-border"
                      }`}
                    />
                  ))}
                </span>
              </div>
              {r.comment && (
                <p className="mt-2 text-muted-foreground">{r.comment}</p>
              )}
              {/* An answer, not a second opinion: inset behind a start-edge rule
                  and set smaller than the review it belongs to, so a reader
                  never mistakes the shop's voice for another customer's. */}
              {r.reply?.trim() && (
                <div className="mt-3 rounded-e-xl border-s-2 border-primary/40 bg-surface-muted/60 px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="flex items-center gap-1 text-xs font-bold text-primary">
                      <CornerDownLeft className="h-3.5 w-3.5 rtl:-scale-x-100" />
                      {dict.reviews.replyFrom}
                    </span>
                    {r.reply_at && (
                      <time
                        dateTime={r.reply_at}
                        dir="ltr"
                        className="text-xs tabular-nums text-muted-foreground"
                      >
                        {new Date(r.reply_at).toLocaleDateString(
                          lang === "ar" ? "ar" : "en",
                          { year: "numeric", month: "short", day: "numeric" },
                        )}
                      </time>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.reply}</p>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">{dict.reviews.noReviews}</p>
        )}
      </div>
    </div>
  );
}
