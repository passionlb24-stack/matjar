import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import type { CategoryKey } from "@/lib/catalog";
import { categoryModule } from "@/lib/modules";
import { Container } from "@/components/ui/container";
import {
  ProductEditForm,
  type ProductInitial,
} from "@/components/product-edit-form";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ lang: string; storeId: string; productId: string }>;
}) {
  const { lang, storeId, productId } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(storeId) || !UUID_RE.test(productId))
    redirect(`/${lang}/merchant`);
  const dict = await getDictionary(lang);

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
    .select("id, name, business_types(slug)")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);
  const category =
    ((store as unknown as { business_types: { slug: string } | null })
      .business_types?.slug as CategoryKey) ?? "retail";
  const mod = categoryModule[category];

  const { data: product } = await supabase
    .from("products")
    .select("id, store_id, name, price, discount_price, description, image_url, gallery, stock, attributes, deal_date")
    .eq("id", productId)
    .eq("store_id", storeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!product) redirect(`/${lang}/merchant/${storeId}`);

  const [{ data: variants }, { data: options }] = await Promise.all([
    supabase
      .from("product_variants")
      .select("label, price, stock")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_options")
      .select("name, price")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true }),
  ]);

  const gallery = Array.isArray(product.gallery)
    ? (product.gallery as string[])
    : [];

  const initial: ProductInitial = {
    name: (product.name as string) ?? "",
    price: product.price != null ? String(product.price) : "",
    discountPrice: product.discount_price != null ? String(product.discount_price) : "",
    description: (product.description as string | null) ?? "",
    imageUrl: (product.image_url as string | null) ?? null,
    gallery,
    stock: product.stock != null ? String(product.stock) : "",
    dealToday:
      (product.deal_date as string | null) ===
      new Date().toISOString().slice(0, 10),
    attributes: (product.attributes as Record<string, string> | null) ?? {},
    variants: (variants ?? []).map((v) => ({
      label: (v.label as string) ?? "",
      price: v.price != null ? String(v.price) : "",
      stock: v.stock != null ? String(v.stock) : "",
    })),
    options: (options ?? []).map((o) => ({
      name: (o.name as string) ?? "",
      price: o.price != null ? String(o.price) : "",
    })),
  };

  return (
    <div className="py-10">
      <Container className="max-w-2xl">
        <Link
          href={`/${lang}/merchant/${storeId}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {(store as { name: string }).name}
        </Link>
        <div className="mt-5">
          <ProductEditForm
            storeId={storeId}
            productId={productId}
            lang={lang}
            category={category}
            dict={dict}
            simplified={mod.simplifiedItem}
            initial={initial}
          />
        </div>
      </Container>
    </div>
  );
}
