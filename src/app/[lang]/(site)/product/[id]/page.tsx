import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Store as StoreIcon, ArrowLeft } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { regions, type CategoryKey } from "@/lib/catalog";
import { attributeSummary } from "@/lib/attributes";
import { Container } from "@/components/ui/container";
import { ProductGallery } from "@/components/product-gallery";
import { ProductOrder, type Variant, type AddOn } from "@/components/product-order";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bookingCategories = new Set<CategoryKey>([
  "services",
  "healthcare",
  "realEstate",
]);

function formatPrice(price: number) {
  return price >= 1000 ? `$${Number(price).toLocaleString("en-US")}` : `$${price}`;
}

type ProductView = {
  id: string;
  storeId: string;
  storeName: string;
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  category: CategoryKey;
  name: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  stock: number | null;
  images: string[];
  attributes: Record<string, string> | null;
  variants: Variant[];
  addons: AddOn[];
};

async function loadProduct(id: string): Promise<ProductView | null> {
  if (!UUID_RE.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, store_id, name, description, price, discount_price, image_url, gallery, stock, attributes, stores(name, accepts_delivery, accepts_pickup, business_types(slug))",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;

  const store = data.stores as unknown as {
    name: string;
    accepts_delivery: boolean | null;
    accepts_pickup: boolean | null;
    business_types: { slug: string } | null;
  } | null;

  const [{ data: variants }, { data: addons }] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id, label, price, stock, is_available")
      .eq("product_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_options")
      .select("id, name, price")
      .eq("product_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  const gallery = Array.isArray(data.gallery) ? (data.gallery as string[]) : [];
  const images = [data.image_url as string | null, ...gallery].filter(
    Boolean,
  ) as string[];

  return {
    id: data.id as string,
    storeId: data.store_id as string,
    storeName: store?.name ?? "",
    acceptsDelivery: store?.accepts_delivery ?? true,
    acceptsPickup: store?.accepts_pickup ?? true,
    category: (store?.business_types?.slug as CategoryKey) ?? "retail",
    name: data.name as string,
    description: (data.description as string | null) ?? null,
    price: Number(data.price),
    discountPrice: data.discount_price != null ? Number(data.discount_price) : null,
    stock: data.stock != null ? Number(data.stock) : null,
    images,
    attributes: (data.attributes as Record<string, string> | null) ?? null,
    variants: (variants ?? []).map((v) => ({
      id: v.id as string,
      label: v.label as string,
      price: v.price != null ? Number(v.price) : null,
      stock: v.stock != null ? Number(v.stock) : null,
      is_available: v.is_available as boolean,
    })),
    addons: (addons ?? []).map((a) => ({
      id: a.id as string,
      name: a.name as string,
      price: Number(a.price),
    })),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLocale(lang)) return {};
  const product = await loadProduct(id);
  return { title: product ? `${product.name} | Matjar` : "Matjar" };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  const product = await loadProduct(id);
  if (!product) notFound();

  const dict = await getDictionary(lang);
  const l = lang as Locale;

  // Prefill checkout from the customer's saved address.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let defaultAddress = "";
  if (user) {
    const { data: addr } = await supabase
      .from("addresses")
      .select("region, city, street, building, floor, details")
      .eq("user_id", user.id)
      .maybeSingle();
    if (addr) {
      const regionName =
        regions.find((r) => r.key === addr.region)?.name[l] ??
        (addr.region as string | null) ??
        "";
      defaultAddress = [
        addr.street,
        addr.building,
        addr.floor,
        addr.city,
        regionName,
        addr.details,
      ]
        .filter(Boolean)
        .join("، ");
    }
  }

  const basePrice = product.discountPrice ?? product.price;
  const attrText = attributeSummary(product.category, product.attributes, l);
  const isBooking = bookingCategories.has(product.category);
  const soldOut = product.stock != null && product.stock <= 0;

  return (
    <div className="py-8">
      <Container>
        <Link
          href={`/${lang}/store/${product.storeId}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {product.storeName || dict.product.backToStore}
        </Link>

        <div className="grid gap-8 lg:grid-cols-2">
          <ProductGallery images={product.images} />

          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {product.name}
            </h1>

            <div className="mt-3 flex items-center gap-3">
              {product.discountPrice != null ? (
                <>
                  <span className="text-2xl font-extrabold text-primary">
                    {formatPrice(product.discountPrice)}
                  </span>
                  <span className="text-lg text-muted-foreground line-through">
                    {formatPrice(product.price)}
                  </span>
                </>
              ) : (
                <span className="text-2xl font-extrabold text-primary">
                  {formatPrice(product.price)}
                </span>
              )}
              {product.stock != null && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    soldOut
                      ? "bg-red-100 text-red-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {soldOut ? dict.product.outOfStock : dict.product.inStock}
                </span>
              )}
            </div>

            {attrText && (
              <p className="mt-3 text-sm text-muted-foreground">{attrText}</p>
            )}
            {product.description && (
              <div className="mt-5">
                <h2 className="text-sm font-bold text-muted-foreground">
                  {dict.product.description}
                </h2>
                <p className="mt-1.5 whitespace-pre-line leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
              {isBooking ? (
                <Link
                  href={`/${lang}/store/${product.storeId}`}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  <StoreIcon className="h-4 w-4" />
                  {dict.product.visitStore}
                </Link>
              ) : (
                <ProductOrder
                  lang={lang}
                  dict={dict}
                  storeId={product.storeId}
                  productId={product.id}
                  productName={product.name}
                  basePrice={basePrice}
                  stock={product.stock}
                  variants={product.variants}
                  addons={product.addons}
                  defaultAddress={defaultAddress}
                  acceptsDelivery={product.acceptsDelivery}
                  acceptsPickup={product.acceptsPickup}
                />
              )}
            </div>

            <Link
              href={`/${lang}/store/${product.storeId}`}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <StoreIcon className="h-4 w-4" />
              {dict.product.visitStore}
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
