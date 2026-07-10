import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Store as StoreIcon } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { localeAlternates, SITE_URL } from "@/lib/site";
import { productJsonLd, jsonLdScript } from "@/lib/jsonld";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { regions, type CategoryKey } from "@/lib/catalog";
import { attributeSummary } from "@/lib/attributes";
import { getUsdLbpRate } from "@/lib/data/settings";
import { getMoreFromStore, getSimilarProducts } from "@/lib/data/related";
import { getProductReviews } from "@/lib/data/product-reviews";
import { ProductReviews } from "@/components/product-reviews";
import { RecentlyViewed } from "@/components/recently-viewed";
import { formatLbp } from "@/lib/currency";
import { ProductMiniCard } from "@/components/product-mini-card";
import { Container } from "@/components/ui/container";
import { ProductGallery } from "@/components/product-gallery";
import { ProductOrder, type Variant, type AddOn } from "@/components/product-order";
import { WishlistButton } from "@/components/wishlist-button";
import { ShareButton } from "@/components/share-button";
import { ProductStoryCard } from "@/components/product-story-card";

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
  if (!product) return { title: "Matjar" };
  const description =
    product.description ||
    (lang === "ar"
      ? `${product.name} من ${product.storeName} على متجر.`
      : `${product.name} from ${product.storeName} on Matjar.`);
  const image = product.images[0];
  return {
    title: product.name,
    description,
    alternates: localeAlternates(lang, `/product/${id}`),
    openGraph: {
      title: product.name,
      description,
      images: image ? [image] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: product.name,
      description,
    },
  };
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

  let isWishlisted = false;
  if (user) {
    const { data: wl } = await supabase
      .from("wishlist")
      .select("product_id")
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .maybeSingle();
    isWishlisted = !!wl;
  }

  const basePrice = product.discountPrice ?? product.price;
  const lbpRate = await getUsdLbpRate();
  const [moreFromStore, similar, productReviews, soldRes] = await Promise.all([
    getMoreFromStore(product.storeId, product.id),
    getSimilarProducts(product.category, product.storeId, product.id),
    getProductReviews(product.id, user?.id ?? null),
    supabase.rpc("product_sold_count", { p_product_id: product.id }),
  ]);
  const soldCount = (soldRes.data as number | null) ?? 0;
  const attrText = attributeSummary(product.category, product.attributes, l);
  const isBooking = bookingCategories.has(product.category);
  const soldOut = product.stock != null && product.stock <= 0;

  return (
    <div className="py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            productJsonLd({
              name: product.name,
              description: product.description,
              image: product.images[0],
              url: `${SITE_URL}/${lang}/product/${id}`,
              price: basePrice,
              storeName: product.storeName,
              available: !soldOut,
              rating: productReviews.avg,
              reviewCount: productReviews.count,
            }),
          ),
        }}
      />
      <Container>
        <Breadcrumbs
          items={[
            { label: dict.common.brand, href: `/${lang}` },
            {
              label: product.storeName || dict.product.backToStore,
              href: `/${lang}/store/${product.storeId}`,
            },
            { label: product.name },
          ]}
        />

        <div className="grid gap-8 lg:grid-cols-2">
          <ProductGallery images={product.images} alt={product.name} />

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
              {product.stock != null &&
                (soldOut ? (
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                    {dict.product.outOfStock}
                  </span>
                ) : product.stock <= 5 ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                    {dict.product.lowStock.replace("{n}", String(product.stock))}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                    {dict.product.inStock}
                  </span>
                ))}
            </div>

            {soldCount > 0 && (
              <p className="mt-1.5 text-sm font-semibold text-primary">
                🔥 {dict.product.soldCount.replace("{n}", String(soldCount))}
              </p>
            )}

            {lbpRate > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {formatLbp(basePrice, lbpRate, l)}
              </p>
            )}

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
                  lbpRate={lbpRate}
                />
              )}
            </div>

            <div className="mt-3">
              <WishlistButton
                productId={product.id}
                wishlisted={isWishlisted}
                lang={lang}
                dict={dict}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <ShareButton title={product.name} dict={dict} />
              <ProductStoryCard
                productId={product.id}
                name={product.name}
                price={basePrice}
                imageUrl={product.images[0] ?? null}
                baseUrl={SITE_URL}
                dict={dict}
              />
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

        <ProductReviews
          data={productReviews}
          productId={product.id}
          canWrite={!!user}
          lang={l}
          dict={dict}
        />

        {moreFromStore.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-bold">
              {dict.product.moreFromStore}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {moreFromStore.map((p) => (
                <ProductMiniCard
                  key={p.id}
                  lang={lang}
                  id={p.id}
                  name={p.name}
                  price={p.price}
                  discountPrice={p.discountPrice}
                  imageUrl={p.imageUrl}
                  lbpRate={lbpRate}
                />
              ))}
            </div>
          </section>
        )}

        {similar.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-bold">{dict.product.similar}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {similar.map((p) => (
                <ProductMiniCard
                  key={p.id}
                  lang={lang}
                  id={p.id}
                  name={p.name}
                  price={p.price}
                  discountPrice={p.discountPrice}
                  imageUrl={p.imageUrl}
                  storeName={p.storeName}
                  lbpRate={lbpRate}
                />
              ))}
            </div>
          </section>
        )}

        <RecentlyViewed currentId={product.id} lang={l} dict={dict} />
      </Container>
    </div>
  );
}
