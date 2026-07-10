import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { AdminReviewDelete } from "@/components/admin-review-delete";

export default async function AdminReviewsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, comment, customer_name, created_at, stores(name)")
    .order("rating", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = (data ?? []) as unknown as {
    id: string;
    rating: number;
    comment: string | null;
    customer_name: string | null;
    created_at: string;
    stores: { name: string } | null;
  }[];

  const t = dict.admin.reviews;

  return (
    <div className="py-10">
      <Container>
        <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>

        <div className="mt-6 space-y-2">
          {rows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
              {t.empty}
            </div>
          )}
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 font-bold">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {r.rating}
                  </span>
                  <span className="font-semibold">{r.stores?.name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.customer_name ?? "—"}
                  </span>
                </div>
                {r.comment && (
                  <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>
                )}
              </div>
              <AdminReviewDelete reviewId={r.id} label={t.delete} />
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
