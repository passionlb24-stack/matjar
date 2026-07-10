import { createClient } from "@/lib/supabase/server";

export type ProductReview = {
  id: string;
  rating: number;
  comment: string | null;
  photos: string[];
  customerName: string | null;
  verified: boolean;
  createdAt: string;
  isMine: boolean;
};

export type ProductReviewsData = {
  reviews: ProductReview[];
  avg: number | null;
  count: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  mine: boolean;
};

export async function getProductReviews(
  productId: string,
  currentUserId: string | null,
): Promise<ProductReviewsData> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_reviews")
    .select(
      "id, rating, comment, photos, customer_name, verified, created_at, customer_id",
    )
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as {
    id: string;
    rating: number;
    comment: string | null;
    photos: unknown;
    customer_name: string | null;
    verified: boolean;
    created_at: string;
    customer_id: string;
  }[];

  const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  const reviews: ProductReview[] = rows.map((r) => {
    sum += r.rating;
    if (r.rating >= 1 && r.rating <= 5) breakdown[r.rating as 1 | 2 | 3 | 4 | 5]++;
    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      photos: Array.isArray(r.photos) ? (r.photos as string[]) : [],
      customerName: r.customer_name,
      verified: r.verified,
      createdAt: r.created_at,
      isMine: currentUserId != null && r.customer_id === currentUserId,
    };
  });

  return {
    reviews,
    count: reviews.length,
    avg: reviews.length ? sum / reviews.length : null,
    breakdown,
    mine: reviews.some((r) => r.isMine),
  };
}
