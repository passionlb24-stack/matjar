import Image from "next/image";
import { cache } from "react";
import { notFound } from "next/navigation";
import { Clock, MapPin, MessageCircle, Phone, Star, Stethoscope, BadgeCheck, Truck } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import {
  categoryStyles,
  getStoreById,
  regions,
  sampleProducts,
  type CategoryKey,
} from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { localeAlternates, SITE_URL } from "@/lib/site";
import { storeJsonLd, jsonLdScript } from "@/lib/jsonld";
import { parseHours, isOpenNow, daySpan } from "@/lib/hours";
import { getUsdLbpRate } from "@/lib/data/settings";
import { categoryIcons } from "@/components/category-icon";
import { Container } from "@/components/ui/container";
import { StoreProducts } from "@/components/store-products";
import { BookingPanel } from "@/components/booking-panel";
import { ServiceRequestForm } from "@/components/service-request-form";
import { StoreReviews, type Review } from "@/components/store-reviews";
import { FollowButton } from "@/components/follow-button";
import { ShareButton } from "@/components/share-button";
import { MessageStoreButton } from "@/components/message-store-button";
import { ProBadge } from "@/components/pro-badge";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bookingCategories = new Set(["services", "healthcare", "realEstate"]);

function formatPrice(price: number) {
  return price >= 1000
    ? `$${Number(price).toLocaleString("en-US")}`
    : `$${price}`;
}

type StoreView = {
  name: string;
  category: CategoryKey;
  area: string | null;
  description: string | null;
  isOpen: boolean;
  plan?: "free" | "pro";
  rating?: number;
  reviews?: number;
  logoUrl?: string | null;
  coverUrl?: string | null;
  openingHours?: string | null;
  hours?: unknown;
  bookingSlotMinutes?: number;
  instagram?: string | null;
  facebook?: string | null;
  website?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  acceptsDelivery?: boolean;
  acceptsPickup?: boolean;
  minOrder?: number | null;
  prepTime?: string | null;
  paymentNote?: string | null;
  specialties?: string | null;
  insurance?: string | null;
  registered?: boolean;
  isReal: boolean;
  products: {
    id?: string;
    name: string;
    price: number;
    discountPrice?: number | null;
    imageUrl?: string | null;
    attributes?: Record<string, string> | null;
    flashPrice?: number | null;
    flashStart?: string | null;
    flashEnd?: string | null;
    stock?: number | null;
  }[];
};

// React cache(): generateMetadata + the page both call loadStore(id) — dedupe
// the multi-query load into one set per request.
const loadStore = cache(async function loadStore(
  id: string,
  lang: Locale,
): Promise<StoreView | null> {
  if (UUID_RE.test(id)) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("stores")
      .select("name, description, area, status, plan, logo_url, cover_url, phone, whatsapp, opening_hours, hours, booking_slot_minutes, instagram, facebook, website, accepts_delivery, accepts_pickup, min_order, prep_time, payment_note, specialties, insurance, commercial_reg_verified, business_types(slug)")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (data) {
      const bt = data.business_types as unknown as { slug: string } | null;
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, price, discount_price, image_url, attributes, flash_price, flash_start, flash_end, stock")
        .eq("store_id", id)
        .eq("status", "active")
        .eq("is_available", true)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });
      return {
        name: data.name as string,
        category: (bt?.slug as CategoryKey) ?? "retail",
        area: (data.area as string | null) ?? null,
        description: (data.description as string | null) ?? null,
        isOpen: data.status === "active",
        plan: (data.plan as "free" | "pro" | null) ?? "free",
        logoUrl: (data.logo_url as string | null) ?? null,
        coverUrl: (data.cover_url as string | null) ?? null,
        openingHours: (data.opening_hours as string | null) ?? null,
        hours: data.hours as unknown,
        bookingSlotMinutes: (data.booking_slot_minutes as number | null) ?? 30,
        instagram: (data.instagram as string | null) ?? null,
        facebook: (data.facebook as string | null) ?? null,
        website: (data.website as string | null) ?? null,
        phone: (data.phone as string | null) ?? null,
        whatsapp: (data.whatsapp as string | null) ?? null,
        acceptsDelivery: (data.accepts_delivery as boolean | null) ?? true,
        acceptsPickup: (data.accepts_pickup as boolean | null) ?? true,
        minOrder: data.min_order != null ? Number(data.min_order) : null,
        prepTime: (data.prep_time as string | null) ?? null,
        paymentNote: (data.payment_note as string | null) ?? null,
        specialties: (data.specialties as string | null) ?? null,
        insurance: (data.insurance as string | null) ?? null,
        registered: (data.commercial_reg_verified as boolean | null) ?? false,
        isReal: true,
        products: (prods ?? []).map((p) => ({
          id: p.id as string,
          name: p.name as string,
          price: Number(p.price),
          discountPrice:
            p.discount_price != null ? Number(p.discount_price) : null,
          imageUrl: (p.image_url as string | null) ?? null,
          attributes:
            (p.attributes as Record<string, string> | null) ?? null,
          flashPrice: p.flash_price != null ? Number(p.flash_price) : null,
          flashStart: (p.flash_start as string | null) ?? null,
          flashEnd: (p.flash_end as string | null) ?? null,
          stock: p.stock != null ? Number(p.stock) : null,
        })),
      };
    }
  }
  // Demo catalog fallback.
  const mock = getStoreById(id);
  if (mock) {
    return {
      name: mock.name[lang],
      category: mock.category,
      area: mock.area[lang],
      description: mock.description?.[lang] ?? null,
      isOpen: mock.isOpen,
      rating: mock.rating,
      reviews: mock.reviews,
      isReal: false,
      products: sampleProducts[mock.category].map((p) => ({
        name: p.name[lang],
        price: p.price,
      })),
    };
  }
  return null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) return {};
  const store = await loadStore(id, lang);
  if (!store) return { title: "متجر | Matjar" };
  const description =
    store.description ||
    (lang === "ar"
      ? `${store.name} على متجر — اطلب أو تواصل مباشرةً.`
      : `${store.name} on Matjar — order or contact directly.`);
  const image = store.coverUrl || store.logoUrl || undefined;
  return {
    title: store.name,
    description,
    alternates: localeAlternates(lang, `/store/${id}`),
    openGraph: {
      title: store.name,
      description,
      images: image ? [image] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: store.name,
      description,
    },
  };
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const store = await loadStore(id, lang);
  if (!store) notFound();

  const dict = await getDictionary(lang);

  // Reviews + current viewer (only real DB stores carry reviews).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let reviews: Review[] = [];
  if (store.isReal && UUID_RE.test(id)) {
    const { data } = await supabase
      .from("reviews")
      .select("id, customer_id, customer_name, rating, comment")
      .eq("store_id", id)
      .order("created_at", { ascending: false });
    reviews = (data ?? []) as Review[];
  }

  type DoctorView = {
    id: string;
    name: string;
    specialty: string | null;
    photo_url: string | null;
    bio: string | null;
  };
  let doctors: DoctorView[] = [];
  if (store.isReal && UUID_RE.test(id) && store.category === "healthcare") {
    const { data } = await supabase
      .from("doctors")
      .select("id, name, specialty, photo_url, bio")
      .eq("store_id", id)
      .order("sort_order", { ascending: true });
    doctors = (data ?? []) as DoctorView[];
  }

  let isFollowing = false;
  if (user && store.isReal && UUID_RE.test(id)) {
    const { data: fol } = await supabase
      .from("follows")
      .select("store_id")
      .eq("user_id", user.id)
      .eq("store_id", id)
      .maybeSingle();
    isFollowing = !!fol;
  }
  const lbpRate = await getUsdLbpRate();
  let ordersFulfilled = 0;
  if (store.isReal && UUID_RE.test(id)) {
    const { data: fc } = await supabase.rpc("store_fulfilled_count", {
      p_store_id: id,
    });
    ordersFulfilled = (fc as number | null) ?? 0;
  }
  const avg = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null;
  const headerRating = store.isReal ? avg : (store.rating ?? null);
  const headerCount = store.isReal ? reviews.length : (store.reviews ?? 0);
  const currentUser = user
    ? {
        id: user.id,
        name:
          (user.user_metadata?.full_name as string | undefined) ??
          user.email ??
          "",
      }
    : null;

  // Prefill checkout from the customer's saved addresses (default first).
  let defaultAddress = "";
  const savedAddresses: { label: string; value: string }[] = [];
  if (user) {
    const { data: addrs } = await supabase
      .from("addresses")
      .select("label, region, city, street, building, floor, details, is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false });
    for (const addr of addrs ?? []) {
      const regionName =
        regions.find((r) => r.key === addr.region)?.name[lang] ??
        (addr.region as string | null) ??
        "";
      const value = [
        addr.street,
        addr.building,
        addr.floor,
        addr.city,
        regionName,
        addr.details,
      ]
        .filter(Boolean)
        .join("، ");
      if (!value) continue;
      savedAddresses.push({
        label: (addr.label as string | null) || value,
        value,
      });
      if (addr.is_default && !defaultAddress) defaultAddress = value;
    }
    // Fall back to the first saved address if none is flagged default.
    if (!defaultAddress && savedAddresses.length > 0) {
      defaultAddress = savedAddresses[0].value;
    }
  }

  // Delivery options this store offers via partner couriers.
  type CourierOption = { price: number | null; name: string };
  let couriers: CourierOption[] = [];
  if (store.isReal && UUID_RE.test(id)) {
    const { data: courierRows } = await supabase
      .from("store_couriers")
      .select("price, delivery_companies(name)")
      .eq("store_id", id);
    couriers = ((courierRows ?? []) as unknown as {
      price: number | null;
      delivery_companies: { name: string } | null;
    }[])
      .filter((r) => r.delivery_companies)
      .map((r) => ({ price: r.price, name: r.delivery_companies!.name }));
  }

  // Physical branches. Multi-location stores show them publicly and let the
  // customer pick one at checkout; the primary branch always sorts first.
  type BranchView = {
    id: string;
    name: string | null;
    address: string | null;
    area: string | null;
    phone: string | null;
    lat: number | null;
    lng: number | null;
    is_primary: boolean;
  };
  let branches: BranchView[] = [];
  if (store.isReal && UUID_RE.test(id)) {
    const { data: locs } = await supabase
      .from("store_locations")
      .select("id, name, address, area, phone, lat, lng, is_primary")
      .eq("store_id", id)
      .eq("is_active", true)
      .order("is_primary", { ascending: false });
    branches = (locs ?? []) as BranchView[];
  }

  const Icon = categoryIcons[store.category];
  const style = categoryStyles[store.category];
  const cat = dict.catalog[store.category];
  const isBooking = bookingCategories.has(store.category);
  const sectionTitle =
    store.category === "food"
      ? dict.store.menu
      : store.category === "services" || store.category === "healthcare"
        ? dict.store.services
        : store.category === "realEstate" || store.category === "automotive"
          ? dict.store.listings
          : dict.store.products;

  return (
    <div className="pb-16">
      {store.isReal && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript(
              storeJsonLd({
                name: store.name,
                description: store.description,
                image: store.logoUrl ?? store.coverUrl,
                url: `${SITE_URL}/${lang}/store/${id}`,
                telephone: store.whatsapp ?? store.phone,
                area: store.area,
                rating: headerRating,
                reviewCount: headerCount,
              }),
            ),
          }}
        />
      )}
      <div className="relative h-48 sm:h-60">
        {store.coverUrl ? (
          <Image src={store.coverUrl} alt={store.name} fill className="object-cover" sizes="100vw" priority />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${style.cover}`}>
            <Icon className="h-28 w-28 text-black/[0.06]" />
          </div>
        )}
      </div>

      <Container>
        <div className="-mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
                {store.logoUrl ? (
                  <Image src={store.logoUrl} alt={store.name} width={64} height={64} className="h-full w-full object-cover" sizes="64px" />
                ) : (
                  <span
                    className={`flex h-full w-full items-center justify-center rounded-2xl ${style.iconWrap}`}
                  >
                    <Icon className="h-7 w-7" />
                  </span>
                )}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight">
                    {store.name}
                  </h1>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${store.isOpen ? "bg-emerald-600" : "bg-slate-500"}`}
                  >
                    {store.isOpen ? dict.store.openNow : dict.store.closed}
                  </span>
                  {store.plan === "pro" && <ProBadge />}
                  {store.registered && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {dict.featured.registered}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{cat.name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {headerRating != null && (
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="font-bold">{headerRating.toFixed(1)}</span>
                      <span className="text-muted-foreground">
                        ({headerCount} {dict.featured.reviews})
                      </span>
                    </span>
                  )}
                  {ordersFulfilled > 0 && (
                    <span className="flex items-center gap-1 font-semibold text-emerald-700">
                      <BadgeCheck className="h-4 w-4" />
                      {dict.store.ordersFulfilled.replace(
                        "{n}",
                        String(ordersFulfilled),
                      )}
                    </span>
                  )}
                  {store.prepTime && store.acceptsDelivery && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {dict.store.deliveryIn.replace("{t}", store.prepTime)}
                    </span>
                  )}
                  {store.area && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {store.area}
                    </span>
                  )}
                  {(() => {
                    // Structured hours win: live open/closed + today's span.
                    const wh = parseHours(store.hours);
                    // Server render reads the clock once per request.
                    const now = new Date();
                    const open = isOpenNow(wh, now);
                    const span = daySpan(wh, now);
                    if (open != null) {
                      return (
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                              open
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {open
                              ? dict.os.hours.openNow
                              : dict.os.hours.closedNow}
                          </span>
                          {span && (
                            <span
                              className="text-muted-foreground"
                              dir="ltr"
                            >
                              {span.open}–{span.close}
                            </span>
                          )}
                        </span>
                      );
                    }
                    return store.openingHours ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {store.openingHours}
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {store.isReal && (
                <FollowButton
                  storeId={id}
                  following={isFollowing}
                  lang={lang}
                  dict={dict}
                />
              )}
              <ShareButton title={store.name} dict={dict} />
              {store.isReal && (
                <MessageStoreButton storeId={id} lang={lang} dict={dict} />
              )}
              {store.phone && (
                <a
                  href={`tel:${store.phone}`}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-muted"
                >
                  <Phone className="h-4 w-4" />
                  {dict.store.call}
                </a>
              )}
              {store.whatsapp && (
                <a
                  href={`https://wa.me/${store.whatsapp.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" />
                  {dict.store.whatsapp}
                </a>
              )}
              {store.instagram && (
                <a href={store.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-muted">
                  {dict.merchant.instagram}
                </a>
              )}
              {store.facebook && (
                <a href={store.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-muted">
                  {dict.merchant.facebook}
                </a>
              )}
              {store.website && (
                <a href={store.website} target="_blank" rel="noopener noreferrer" className="flex items-center rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-muted">
                  {dict.merchant.website}
                </a>
              )}
            </div>
          </div>

          {store.description && (
            <p className="mt-4 border-t border-border pt-4 text-muted-foreground">
              {store.description}
            </p>
          )}
        </div>

        {branches.length > 1 && (
          <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-bold">{dict.os.branchesPublic.title}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {branches.map((b) => (
                <li
                  key={b.id}
                  className="flex items-start gap-2.5 rounded-xl border border-border px-3.5 py-2.5 text-sm"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="font-semibold">{b.name || b.area}</p>
                    {b.address && (
                      <p className="mt-0.5 text-muted-foreground">{b.address}</p>
                    )}
                    {b.phone && (
                      <a
                        href={`tel:${b.phone}`}
                        className="mt-0.5 inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span dir="ltr">{b.phone}</span>
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {couriers.length > 0 && (
          <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <Truck className="h-5 w-5 text-primary" />
              {dict.store.deliveryOptions}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {couriers.map((c, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm"
                >
                  <span className="font-semibold">{c.name}</span>
                  {c.price != null && (
                    <span className="font-bold text-primary">
                      {formatPrice(c.price)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {store.isReal &&
          (store.category === "services" ||
            store.category === "healthcare") && (
            <div className="mt-10">
              <ServiceRequestForm storeId={id} lang={lang} dict={dict} />
            </div>
          )}

        <h2 className="mb-4 mt-10 text-xl font-bold">{sectionTitle}</h2>
        {store.isReal ? (
          store.products.length ? (
            isBooking ? (
              <BookingPanel
                storeId={id}
                lang={lang}
                dict={dict}
                category={store.category}
                customerName={currentUser?.name ?? null}
                whatsapp={store.whatsapp ?? null}
                storeName={store.name}
                hours={parseHours(store.hours)}
                slotMinutes={store.bookingSlotMinutes ?? 30}
                services={store.products
                  .filter((p) => p.id)
                  .map((p) => ({
                    id: p.id as string,
                    name: p.name,
                    price: p.price,
                    imageUrl: p.imageUrl,
                    attributes: p.attributes,
                  }))}
              />
            ) : (
              <StoreProducts
                storeId={id}
                lang={lang}
                dict={dict}
                category={store.category}
                isBooking={isBooking}
                loggedIn={!!user}
                defaultAddress={defaultAddress}
                savedAddresses={savedAddresses}
                acceptsDelivery={store.acceptsDelivery ?? true}
                acceptsPickup={store.acceptsPickup ?? true}
                minOrder={store.minOrder ?? null}
                paymentNote={store.paymentNote ?? null}
                prepTime={store.prepTime ?? null}
                whatsapp={store.whatsapp ?? null}
                storeName={store.name}
                lbpRate={lbpRate}
                branches={branches.map((b) => ({
                  id: b.id,
                  name: b.name,
                  area: b.area,
                  address: b.address,
                }))}
                products={store.products
                  .filter((p) => p.id)
                  .map((p) => ({
                    id: p.id as string,
                    name: p.name,
                    price: p.price,
                    discountPrice: p.discountPrice,
                    imageUrl: p.imageUrl,
                    attributes: p.attributes,
                    flashPrice: p.flashPrice,
                    flashStart: p.flashStart,
                    flashEnd: p.flashEnd,
                  }))}
              />
            )
          ) : (
            <div className="rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground">
              {dict.store.noProducts}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {store.products.map((p, i) => (
              <div
                key={`${p.name}-${i}`}
                className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4"
              >
                <span
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${style.cover}`}
                >
                  <Icon className="h-7 w-7 text-black/20" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold">{p.name}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {dict.store.from}{" "}
                    <span className="font-bold text-foreground">
                      {formatPrice(p.price)}
                    </span>
                  </p>
                </div>
                <button className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover">
                  {isBooking ? dict.store.book : dict.store.order}
                </button>
              </div>
            ))}
          </div>
        )}

        {store.category === "healthcare" &&
          (store.specialties || store.insurance) && (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {store.specialties && (
                <div className="rounded-2xl border border-border bg-surface p-5">
                  <h3 className="text-sm font-bold text-muted-foreground">
                    {dict.store.specialtiesTitle}
                  </h3>
                  <p className="mt-1 font-medium">{store.specialties}</p>
                </div>
              )}
              {store.insurance && (
                <div className="rounded-2xl border border-border bg-surface p-5">
                  <h3 className="text-sm font-bold text-muted-foreground">
                    {dict.store.insuranceTitle}
                  </h3>
                  <p className="mt-1 font-medium">{store.insurance}</p>
                </div>
              )}
            </div>
          )}

        {doctors.length > 0 && (
          <>
            <h2 className="mb-4 mt-10 text-xl font-bold">
              {dict.store.doctorsTitle}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {doctors.map((d) => (
                <div
                  key={d.id}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4"
                >
                  {d.photo_url ? (
                    <Image
                      src={d.photo_url}
                      alt=""
                      width={56}
                      height={56}
                      className="h-14 w-14 shrink-0 rounded-full object-cover"
                      sizes="56px"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
                      <Stethoscope className="h-6 w-6" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold">{d.name}</p>
                    {d.specialty && (
                      <p className="text-sm font-semibold text-primary">
                        {d.specialty}
                      </p>
                    )}
                    {d.bio && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {d.bio}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {store.isReal && (
          <StoreReviews
            storeId={id}
            lang={lang}
            dict={dict}
            reviews={reviews}
            currentUser={currentUser}
          />
        )}
      </Container>
    </div>
  );
}
