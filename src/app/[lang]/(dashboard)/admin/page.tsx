import { notFound } from "next/navigation";
import { ShieldCheck, Star } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { AdminBroadcast } from "@/components/admin-broadcast";
import { AdminStoreActions } from "@/components/admin-store-actions";
import { AdminReviewDelete } from "@/components/admin-review-delete";

type ReviewRow = {
  id: string;
  customer_name: string | null;
  rating: number;
  comment: string | null;
  stores: { name: string } | null;
};

type PendingStore = {
  id: string;
  name: string;
  area: string | null;
  business_types: { name_ar: string; name_en: string } | null;
};

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  // Role is already enforced by the admin layout.
  const supabase = await createClient();

  const { data } = await supabase
    .from("stores")
    .select("id, name, area, business_types(name_ar, name_en)")
    .eq("status", "pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  const pending = (data ?? []) as unknown as PendingStore[];

  const [storesRes, usersRes, ordersRes] = await Promise.all([
    supabase
      .from("stores")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
  ]);

  const { data: reviewData } = await supabase
    .from("reviews")
    .select("id, customer_name, rating, comment, stores(name)")
    .order("created_at", { ascending: false })
    .limit(20);
  const reviews = (reviewData ?? []) as unknown as ReviewRow[];

  return (
    <div className="py-10">
      <Container>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-extrabold tracking-tight">
            {dict.admin.title}
          </h1>
        </div>
        <p className="mt-2 text-muted-foreground">{dict.admin.subtitle}</p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: dict.admin.totalStores, value: storesRes.count ?? 0 },
            { label: dict.admin.pendingTitle, value: pending.length },
            { label: dict.admin.users, value: usersRes.count ?? 0 },
            { label: dict.admin.ordersTotal, value: ordersRes.count ?? 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-surface-muted/60 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-1 text-2xl font-extrabold">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <AdminBroadcast dict={dict} />
        </div>

        <h2 className="mb-4 mt-8 text-lg font-bold">{dict.admin.pendingTitle}</h2>
        {pending.length ? (
          <div className="space-y-3">
            {pending.map((store) => (
              <div
                key={store.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h3 className="font-bold">{store.name}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {store.business_types
                      ? lang === "ar"
                        ? store.business_types.name_ar
                        : store.business_types.name_en
                      : null}
                    {store.area ? ` · ${store.area}` : null}
                  </p>
                </div>
                <AdminStoreActions
                  storeId={store.id}
                  approveLabel={dict.admin.approve}
                  rejectLabel={dict.admin.reject}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
            {dict.admin.noPending}
          </div>
        )}

        {reviews.length > 0 && (
          <>
            <h2 className="mb-4 mt-10 text-lg font-bold">
              {dict.admin.reviewsTitle}
            </h2>
            <div className="space-y-3">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-5"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{r.customer_name ?? "—"}</span>
                      <span className="text-sm text-muted-foreground">
                        · {r.stores?.name}
                      </span>
                      <span className="flex items-center gap-0.5 text-sm font-bold">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {r.rating}
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
                    label={dict.admin.deleteReview}
                    confirmLabel={dict.admin.confirmDeleteReview}
                    errorLabel={dict.auth.errorGeneric}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </Container>
    </div>
  );
}
