import { cache } from "react";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import {
  categoryStyles,
  getStoreById,
  regions,
  sampleProducts,
} from "@/lib/catalog";
import { resolveStoreModules, sectorHasTeam } from "@/lib/sectors";
import { createClient } from "@/lib/supabase/server";
import {
  getPublicStoreView,
  getOwnedStoreView,
  type StoreView,
} from "@/lib/data/store-view";
import { localeAlternates, SITE_URL } from "@/lib/site";
import { accentStyle } from "@/lib/color";
import { storeJsonLd, jsonLdScript, toOpeningHours } from "@/lib/jsonld";
import { parseHours } from "@/lib/hours";
import { getUsdLbpRate } from "@/lib/data/settings";
import { categoryIcons } from "@/components/category-icon";
import { Container } from "@/components/ui/container";
import { ServiceRequestForm } from "@/components/service-request-form";
import { StoreReviews, type Review } from "@/components/store-reviews";
import {
  StoreVerifications,
  type StoreVerification,
} from "@/components/store-verifications";
import { StoreMapClient } from "@/components/store-map-client";
import type { MapStore } from "@/components/store-map";
import {
  TimeslotBooking,
  type Resource,
} from "@/components/timeslot-booking";
import {
  StoreMemberships,
  type MembershipPlan,
} from "@/components/store-memberships";
import {
  ClassesBooking,
  type ClassRow,
} from "@/components/classes-booking";
import { ReservationForm } from "@/components/reservation-form";
import { StoreCourses, type CourseRow } from "@/components/store-courses";
import { StorePortfolio, type PortfolioItem } from "@/components/store-portfolio";
import { StoreHero } from "@/components/store/store-hero";
import { StoreHeader } from "@/components/store/store-header";
import { StoreBranches } from "@/components/store/store-branches";
import { StoreDeliveryOptions } from "@/components/store/store-delivery-options";
import { StoreProductsSection } from "@/components/store/store-products-section";
import { StoreHealthcareInfo } from "@/components/store/store-healthcare-info";
import { StoreDoctors, type DoctorView } from "@/components/store/store-doctors";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bookingCategories = new Set(["services", "healthcare", "realEstate"]);

// React cache(): generateMetadata + the page both call loadStore(id) — dedupe
// the load into one call per request. The public store view now comes from
// src/lib/data/store-view.ts (cookie-less + cross-request cached); only the
// owner/admin draft-preview fallback touches the request-scoped client.
const loadStore = cache(async function loadStore(
  id: string,
  lang: Locale,
): Promise<StoreView | null> {
  if (UUID_RE.test(id)) {
    // Common case: cached, cookie-less anon view (RLS → active stores only).
    const real = await getPublicStoreView(id);
    if (real) return real;
    // Owner/admin previewing a not-yet-public store: their RLS grant makes it
    // visible on the request-scoped client. Uncached — visibility is per-user.
    const owned = await getOwnedStoreView(await createClient(), id);
    if (owned) return owned;
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
      sections: [],
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

  // Certificates & licenses (public). Rejected ones are excluded; a store shows
  // the "verified" badge only if it has at least one admin-verified document.
  let verifications: StoreVerification[] = [];
  if (store.isReal && UUID_RE.test(id)) {
    const { data } = await supabase
      .from("store_verifications")
      .select(
        "id, kind, title, issuer, number, issued_on, expires_on, doc_url, verify_url, status",
      )
      .eq("store_id", id)
      .neq("status", "rejected")
      .order("created_at", { ascending: false });
    verifications = (data ?? []) as StoreVerification[];
  }
  const hasVerified = verifications.some((v) => v.status === "verified");

  // Which feature modules this store has switched on (sector defaults overlaid
  // with per-store overrides) — public sections render only for enabled ones.
  const modOverrides: Record<string, boolean> = {};
  if (store.isReal && UUID_RE.test(id)) {
    const { data: modRows } = await supabase
      .from("store_modules")
      .select("module_key, enabled")
      .eq("store_id", id);
    for (const r of (modRows ?? []) as {
      module_key: string;
      enabled: boolean;
    }[]) {
      modOverrides[r.module_key] = r.enabled;
    }
  }
  const enabledModules = resolveStoreModules(store.category, modOverrides);

  // Bookable resources (courts/rooms/rental items) for time-slot sectors.
  let resources: Resource[] = [];
  if (store.isReal && UUID_RE.test(id) && enabledModules.has("timeslot")) {
    const { data: resData } = await supabase
      .from("store_resources")
      .select("id, name, name_en, price, open_hour, close_hour")
      .eq("store_id", id)
      .eq("active", true)
      .order("sort_order", { ascending: true });
    resources = (resData ?? []) as Resource[];
  }

  // Membership / subscription plans for gym/club/school sectors.
  let membershipPlans: MembershipPlan[] = [];
  if (store.isReal && UUID_RE.test(id) && enabledModules.has("memberships")) {
    const { data: mpData } = await supabase
      .from("store_membership_plans")
      .select("id, name, name_en, price, period, description")
      .eq("store_id", id)
      .eq("active", true)
      .order("sort_order", { ascending: true });
    membershipPlans = (mpData ?? []) as MembershipPlan[];
  }

  // Weekly group classes (gym sessions, group courses) for capacity booking.
  let classes: ClassRow[] = [];
  if (store.isReal && UUID_RE.test(id) && enabledModules.has("classes")) {
    const { data: clData } = await supabase
      .from("store_classes")
      .select("id, name, name_en, description, day_of_week, start_time, capacity, price")
      .eq("store_id", id)
      .eq("active", true)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    classes = (clData ?? []) as ClassRow[];
  }

  // Portfolio gallery (services & contractors).
  let portfolio: PortfolioItem[] = [];
  if (store.isReal && UUID_RE.test(id) && enabledModules.has("portfolio")) {
    const { data: pfData } = await supabase
      .from("store_portfolio")
      .select("id, title, title_en, description, image_url, link")
      .eq("store_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    portfolio = (pfData ?? []) as PortfolioItem[];
  }

  // Courses catalogue (education).
  let courses: CourseRow[] = [];
  if (store.isReal && UUID_RE.test(id) && enabledModules.has("courses")) {
    const { data: coData } = await supabase
      .from("store_courses")
      .select("id, name, name_en, description, price, duration, schedule, level")
      .eq("store_id", id)
      .eq("active", true)
      .order("sort_order", { ascending: true });
    courses = (coData ?? []) as CourseRow[];
  }

  let doctors: DoctorView[] = [];
  // providerServices: productId -> the provider ids that offer that service.
  // Empty entry (or absent) = any provider can deliver it.
  const providerServices: Record<string, string[]> = {};
  if (store.isReal && UUID_RE.test(id) && sectorHasTeam(store.category)) {
    const { data } = await supabase
      .from("doctors")
      .select("id, name, specialty, photo_url, bio")
      .eq("store_id", id)
      .order("sort_order", { ascending: true });
    doctors = (data ?? []) as DoctorView[];
    if (doctors.length > 0) {
      const { data: sp } = await supabase
        .from("service_providers")
        .select("product_id, doctor_id")
        .eq("store_id", id);
      for (const row of (sp ?? []) as {
        product_id: string;
        doctor_id: string;
      }[]) {
        (providerServices[row.product_id] ??= []).push(row.doctor_id);
      }
    }
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

  // Map pins: the store's own precise location (set via the pin picker) plus any
  // branch coordinates. Empty → no map section.
  const mapPins: MapStore[] = [];
  if (store.lat != null && store.lng != null)
    mapPins.push({ id, name: store.name, lat: store.lat, lng: store.lng });
  for (const b of branches)
    if (b.lat != null && b.lng != null)
      mapPins.push({
        id,
        name: store.name,
        branch: b.name || b.area,
        lat: b.lat,
        lng: b.lng,
      });

  // Loyalty redemption at checkout: only when the store opted in (0107) and the
  // signed-in customer actually holds points at this store. my_loyalty_by_store
  // returns only stores with a positive balance, so a 0 here renders nothing.
  let loyaltyPoints = 0;
  if (user && store.isReal && UUID_RE.test(id) && store.loyaltyRedemptionEnabled) {
    const { data: byStore } = await supabase.rpc("my_loyalty_by_store");
    const row = ((byStore ?? []) as { store_id: string; balance: number }[]).find(
      (r) => r.store_id === id,
    );
    loyaltyPoints = row ? Number(row.balance) : 0;
  }

  const Icon = categoryIcons[store.category];
  const style = categoryStyles[store.category];
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
    <div
      className="pb-16"
      style={accentStyle(store.accentColor) as React.CSSProperties | undefined}
    >
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
                lat: branches[0]?.lat ?? null,
                lng: branches[0]?.lng ?? null,
                openingHours: toOpeningHours(
                  parseHours(store.hours) as unknown as Record<
                    string,
                    { open: string; close: string }
                  > | null,
                ),
                rating: headerRating,
                reviewCount: headerCount,
              }),
            ),
          }}
        />
      )}
      <StoreHero store={store} Icon={Icon} style={style} dict={dict} lang={lang} />

      <Container>
        <StoreHeader
          store={store}
          id={id}
          Icon={Icon}
          style={style}
          dict={dict}
          lang={lang}
          hasVerified={hasVerified}
          headerRating={headerRating}
          headerCount={headerCount}
          ordersFulfilled={ordersFulfilled}
          isFollowing={isFollowing}
        />

        {branches.length > 1 && (
          <StoreBranches branches={branches} dict={dict} />
        )}

        {couriers.length > 0 && (
          <StoreDeliveryOptions couriers={couriers} dict={dict} />
        )}

        {mapPins.length > 0 && enabledModules.has("location") && (
          <div className="mt-6">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <MapPin className="h-5 w-5 text-primary" />
              {dict.merchant.mapLocation}
            </h2>
            <StoreMapClient stores={mapPins} lang={lang} heightClass="h-72" />
          </div>
        )}

        {store.isReal &&
          (store.category === "services" ||
            store.category === "healthcare") && (
            <div className="mt-10">
              <ServiceRequestForm storeId={id} lang={lang} dict={dict} />
            </div>
          )}

        {resources.length > 0 && (
          <TimeslotBooking
            storeId={id}
            lang={lang}
            dict={dict}
            resources={resources}
            customerName={currentUser?.name ?? null}
          />
        )}

        {membershipPlans.length > 0 && (
          <StoreMemberships
            plans={membershipPlans}
            dict={dict}
            lang={lang}
            whatsapp={store.whatsapp ?? null}
          />
        )}

        {classes.length > 0 && (
          <ClassesBooking
            storeId={id}
            lang={lang}
            dict={dict}
            classes={classes}
            customerName={currentUser?.name ?? null}
          />
        )}

        {store.isReal && enabledModules.has("reservations") && (
          <ReservationForm storeId={id} lang={lang} dict={dict} />
        )}

        {courses.length > 0 && (
          <StoreCourses courses={courses} dict={dict} lang={lang} whatsapp={store.whatsapp ?? null} />
        )}

        {portfolio.length > 0 && (
          <StorePortfolio items={portfolio} dict={dict} lang={lang} />
        )}

        <StoreProductsSection
          sectionTitle={sectionTitle}
          store={store}
          id={id}
          lang={lang}
          dict={dict}
          isBooking={isBooking}
          doctors={doctors}
          providerServices={providerServices}
          currentUser={currentUser}
          loggedIn={!!user}
          defaultAddress={defaultAddress}
          savedAddresses={savedAddresses}
          lbpRate={lbpRate}
          loyaltyPoints={loyaltyPoints}
          branches={branches}
          Icon={Icon}
          style={style}
        />

        {store.category === "healthcare" &&
          (store.specialties || store.insurance) && (
            <StoreHealthcareInfo store={store} dict={dict} />
          )}

        {doctors.length > 0 && <StoreDoctors doctors={doctors} dict={dict} />}

        {store.isReal && enabledModules.has("verifications") && (
          <StoreVerifications
            verifications={verifications}
            dict={dict}
            lang={lang}
          />
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
