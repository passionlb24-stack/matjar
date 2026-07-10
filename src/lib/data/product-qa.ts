import { createClient } from "@/lib/supabase/server";

export type ProductQuestion = {
  id: string;
  askerName: string | null;
  question: string;
  answer: string | null;
  createdAt: string;
  isMine: boolean;
};

export async function getProductQuestions(
  productId: string,
  currentUserId: string | null,
): Promise<ProductQuestion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_questions")
    .select("id, asker_id, asker_name, question, answer, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    (data ?? []) as unknown as {
      id: string;
      asker_id: string;
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
    isMine: currentUserId != null && q.asker_id === currentUserId,
  }));
}
