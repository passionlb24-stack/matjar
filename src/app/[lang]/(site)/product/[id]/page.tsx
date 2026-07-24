import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Store as StoreIcon } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { localeAlternates, SITE_URL } from "@/lib/site";
import { productJsonLd, jsonLdScript } from "@/lib/jsonld";
import {
  getPublicProductView,
  getOwnedProductView,
  type ProductView,
} from "@/lib/data/product-view";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { regions, type CategoryKey } from "@/lib/catalog";
import { attributeSummary } from "@/lib/attributes";
import { effectivePrice, compareAtPrice, flashEndsAt } from "@/lib/pricing";
import { FlashCountdown } from "@/components/flash-countdown";
import { getUsdLbpRate } from "@/lib/data/settings";
import {
  getMoreFromStore,
  getSimilarProducts,
  getBoughtTogether,
} from "@/lib/data/related";
import { getProductReviews } from "@/lib/data/product-reviews";
import { getProductQuestions } from "@/lib/data/product-qa";
import { ProductReviews } from "@/components/product-reviews";
import { ProductQA } from "@/components/product-qa";
import { RecentlyViewed } from "@/components/recently-viewed";
import { formatLbp } from "@/lib/currency";
import { localized } from "@/lib/i18n-field";
import { ProductMiniCard } from "@/components/product-mini-card";
import { Container } from "@/components/ui/container";
import { ProductGallery } from "@/components/product-gallery";
import { ProductOrder } from "@/components/product-order";
import { WishlistButton } from "@/components/wishlist-button";
import { ShareButton } from "@/components/share-button";
import { ProductStoryCard } from "@/components/product-story-card";
import { BackButton } from "@/components/back-button";

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

// React cache(): generateMetadata and the page both call loadProduct(id) for
// the same request — dedupe into one call. The public product view now comes
// from src/lib/data/product-view.ts (cookie-less + cross-request cached); only
// the owner/staff draft-preview fallback touches the request-scoped client.
const loadProduct = cache(async function loadProduct(
  id: string,
): Promise<ProductView | null> {
  if (!UUID_RE.test(id)) return null;
  // Common case: cached, cookie-less anon view (RLS → active products only).
  const pub = await getPublicProductView(id);
  if (pub) return pub;
  // Owner/staff previewing a not-yet-public product: their RLS grant makes it
  // visible on the request-scoped client. Uncached — visibility is per-user.
  return getOwnedProductView(await createClient(), id);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLocale(lang)) return {};
  const product = await loadProduct(id);
  if (!product) return { title: "Matjar" };
  const name = localized(product.name, product.nameEn, lang);
  const localizedDesc = localized(
    product.description ?? "",
    product.descriptionEn,
    lang,
  );
  const description =
    localizedDesc ||
    (lang === "ar"
      ? `${name} من ${product.storeName} على متجر.`
      : `${name} from ${product.storeName} on Matjar.`);
  const image = product.images[0];
  return {
    title: name,
    description,
    alternates: localeAlternates(lang, `/product/${id}`),
    openGraph: {
      title: name,
      description,
      images: image ? [image] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: name,
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
  const name = localized(product.name, product.nameEn, l);
  const description = localized(
    product.description ?? "",
    product.descriptionEn,
    l,
  );

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

  const basePrice = effectivePrice(product);
  const compareAt = compareAtPrice(product);
  const flashEnd = flashEndsAt(product);
  const lbpRate = await getUsdLbpRate();
  const [moreFromStore, similar, boughtTogether, productReviews, questions, soldRes] =
    await Promise.all([
      getMoreFromStore(product.storeId, product.id),
      getSimilarProducts(product.category, product.storeId, product.id),
      getBoughtTogether(product.id),
      getProductReviews(product.id, user?.id ?? null),
      getProductQuestions(product.id, user?.id ?? null),
      supabase.rpc("product_sold_count", { p_product_id: product.id }),
    ]);
  const soldCount = (soldRes.data as number | null) ?? 0;

  let isStoreOwner = false;
  if (user) {
    const { data: st } = await supabase
      .from("stores")
      .select("owner_id")
      .eq("id", product.storeId)
      .maybeSingle();
    isStoreOwner = (st as { owner_id?: string } | null)?.owner_id === user.id;
  }
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
              name,
              description,
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
        <div className="pt-4">
          <BackButton label={dict.common.back} fallbackHref={`/${lang}/store/${product.storeId}`} />
        </div>
        <Breadcrumbs
          items={[
            { label: dict.common.brand, href: `/${lang}` },
            {
              label: product.storeName || dict.product.backToStore,
              href: `/${lang}/store/${product.storeId}`,
            },
            { label: name },
          ]}
        />

        <div className="grid gap-8 lg:grid-cols-2">
          <ProductGallery images={product.images} alt={name} />

          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {name}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span
                className={`text-2xl font-extrabold ${flashEnd != null ? "text-warning" : "text-primary"}`}
              >
                {formatPrice(basePrice)}
              </span>
              {compareAt != null && (
                <span className="text-lg text-muted-foreground line-through">
                  {formatPrice(compareAt)}
                </span>
              )}
              {flashEnd != null && (
                <FlashCountdown endsAt={flashEnd} dict={dict} />
              )}
              {product.stock != null &&
                (soldOut ? (
                  <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-bold text-danger">
                    {dict.product.outOfStock}
                  </span>
                ) : product.stock <= 5 ? (
                  <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-bold text-warning">
                    {dict.product.lowStock.replace("{n}", String(product.stock))}
                  </span>
                ) : (
                  <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success">
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
            {description && (
              <div className="mt-5">
                <h2 className="text-sm font-bold text-muted-foreground">
                  {dict.product.description}
                </h2>
                <p className="mt-1.5 whitespace-pre-line leading-relaxed">
                  {description}
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
              <ShareButton title={name} dict={dict} />
              <ProductStoryCard
                productId={product.id}
                name={name}
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

        {boughtTogether.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-bold">
              {dict.product.boughtTogether}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {boughtTogether.map((p) => (
                <ProductMiniCard
                  key={p.id}
                  lang={lang}
                  id={p.id}
                  name={p.name}
                  nameEn={p.nameEn}
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

        <ProductReviews
          data={productReviews}
          productId={product.id}
          canWrite={!!user}
          lang={l}
          dict={dict}
        />

        <ProductQA
          productId={product.id}
          questions={questions}
          canAsk={!!user}
          canAnswer={isStoreOwner}
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
                  nameEn={p.nameEn}
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
                  nameEn={p.nameEn}
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
