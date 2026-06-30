import Link from "next/link";
import { Star } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { ReviewForm } from "@/components/review-form";

export type Review = {
  id: string;
  customer_id: string;
  customer_name: string | null;
  rating: number;
  comment: string | null;
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
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">{dict.reviews.noReviews}</p>
        )}
      </div>
    </div>
  );
}
