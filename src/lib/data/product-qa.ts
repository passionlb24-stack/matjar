import { createClient } from "@/lib/supabase/server";

// MP-010. The public Q&A projection carries a display name and no account id.
//
// This read runs as `anon` for the overwhelming majority of visitors, and it
// used to select `asker_id` so the mapper could stamp an `isMine` boolean on
// every row. Nothing ever rendered that boolean — no component read it — so the
// only thing the column achieved was to put a stable per-person identifier into
// a `select using (true)` table that anyone can page through, which is exactly
// the cross-table correlator MP-010 is about.
//
// The column is gone from the query entirely, for signed-in and signed-out
// readers alike. Nothing here references `asker_id` any more, so SELECT on it
// can be withdrawn from both browser roles.
export type ProductQuestion = {
  id: string;
  askerName: string | null;
  question: string;
  answer: string | null;
  createdAt: string;
};

export async function getProductQuestions(
  productId: string,
): Promise<ProductQuestion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_questions")
    .select("id, asker_name, question, answer, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    (data ?? []) as unknown as {
      id: string;
      asker_name: string | null;
      question: string;
      answer: string | null;
      created_at: string;
    }[]
  ).map((q) => ({
    id: q.id,
    askerName: q.asker_name,
    question: q.question,
    answer: q.answer,
    createdAt: q.created_at,
  }));
}
