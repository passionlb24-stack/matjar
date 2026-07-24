import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { requireAdminSection } from "@/lib/admin-guard";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminReviewDelete } from "@/components/admin-review-delete";

export default async function AdminReviewsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireAdminSection("reviews", lang);
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
        <PageHeader icon={Star} title={t.title} subtitle={t.subtitle} />

        {rows.length === 0 ? (
          <EmptyState icon={Star} title={t.empty} />
        ) : (
          <Card data-animate>
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          r.rating >= 4
                            ? "success"
                            : r.rating >= 3
                              ? "warning"
                              : "danger"
                        }
                        size="sm"
                      >
                        <Star className="h-3 w-3 fill-current" />
                        {r.rating}
                      </Badge>
                      <span className="font-semibold">
                        {r.stores?.name ?? "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {r.customer_name ?? "—"}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {r.comment}
                      </p>
                    )}
                  </div>
                  <AdminReviewDelete
                    reviewId={r.id}
                    label={t.delete}
                    confirmLabel={dict.admin.confirmDeleteReview}
                    errorLabel={dict.auth.errorGeneric}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}
      </Container>
    </div>
  );
}
