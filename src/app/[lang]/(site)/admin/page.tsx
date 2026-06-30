import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { AdminStoreActions } from "@/components/admin-store-actions";

type PendingStore = {
  id: string;
  name: string;
  area: string | null;
  business_types: { name_ar: string; name_en: string } | null;
};

export default async function AdminPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "super_admin") redirect(`/${lang}`);

  const { data } = await supabase
    .from("stores")
    .select("id, name, area, business_types(name_ar, name_en)")
    .eq("status", "pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const pending = (data ?? []) as unknown as PendingStore[];

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
      </Container>
    </div>
  );
}
