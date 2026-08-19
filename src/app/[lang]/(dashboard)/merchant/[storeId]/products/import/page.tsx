// Bulk product import. The plan gate is enforced inside import_products()
// (migration 0214); what is passed down here only decides what the merchant is
// shown, and the cap numbers so the screen can say exactly where they stand
// rather than "upgrade for more".

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { ChevronPrev } from "@/components/ui/directional-icon";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { getStorePlan } from "@/lib/plan-server";
import { hasPlan, planProductLimit } from "@/lib/plan-tiers";
import { Container } from "@/components/ui/container";
import { ProductImportClient } from "@/components/product-import-client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProductImportPage({
  params,
}: {
  params: Promise<{ lang: string; storeId: string }>;
}) {
  const { lang, storeId } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(storeId)) redirect(`/${lang}/merchant`);
  const dict = await getDictionary(lang);
  const t = dict.merchant.productImport;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data: canManage } = await supabase.rpc("can_manage_store", {
    p_store_id: storeId,
  });
  if (!canManage) redirect(`/${lang}/merchant`);
  const { data: store } = await supabase
    .from("stores")
    .select("id, name")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);

  const plan = await getStorePlan(storeId);
  const canImport = hasPlan(plan, "pro");
  const limit = planProductLimit(plan);

  // Existing skus let the review say "40 new, 107 updated" instead of just a
  // total — the difference between adding a catalogue and repricing one.
  const { data: rows } = await supabase
    .from("products")
    .select("sku")
    .eq("store_id", storeId)
    .is("deleted_at", null);
  const products = (rows ?? []) as { sku: string | null }[];
  const existingSkus = products
    .map((p) => (p.sku ?? "").trim().toLowerCase())
    .filter(Boolean);

  return (
    <div className="py-10">
      <Container className="max-w-2xl">
        <Link
          href={`/${lang}/merchant/${storeId}/items`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronPrev className="h-4 w-4" />
          {(store as { name: string }).name}
        </Link>
        <h1 className="mt-3 flex items-center gap-2 text-3xl font-extrabold tracking-tight">
          <FileSpreadsheet className="h-7 w-7 text-primary" />
          {t.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>

        <div className="mt-6">
          <ProductImportClient
            storeId={storeId}
            lang={lang}
            canImport={canImport}
            planLimit={Number.isFinite(limit) ? limit : Number.MAX_SAFE_INTEGER}
            existingCount={products.length}
            existingSkus={existingSkus}
            dict={dict}
          />
        </div>
      </Container>
    </div>
  );
}
