import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { StoreView } from "@/lib/data/store-view";
import type { ItemSurface } from "@/lib/store-experience";
import { attributeSummary } from "@/lib/attributes";
import { waLink } from "@/lib/whatsapp";
import { parseHours } from "@/lib/hours";
import { StoreProducts, type DeliveryZone } from "@/components/store-products";
import type { DoctorView } from "@/components/store/store-doctors";

// The two engines below are mutually exclusive on any given render — `surface`
// picks one — but both used to be statically imported, so every storefront
// shipped both. `StoreProducts` (cart, coupon, loyalty, zones, idempotency key)
// stays a static import on purpose: the order surface is the common case, it is
// the money path, and nothing about its state may be made to arrive late.
// The appointment engine, which only appointment sectors ever draw, is fetched
// when it is the one that renders — it is still server-rendered, so the service
// list and its prices stay in the HTML. See store/lazy-engines.tsx.
import { BookingPanel } from "@/components/store/lazy-engines";
import { Money } from "@/components/ui/money";

export function StoreProductsSection({
  sectionTitle,
  store,
  id,
  lang,
  dict,
  surface,
  canOrderProducts,
  initialServiceId = null,
  directoryOnly = false,
  doctors,
  providerServices,
  currentUser,
  loggedIn,
  defaultAddress,
  savedAddresses,
  lbpRate,
  loyaltyPoints,
  branches,
  Icon,
  style,
  initialBrand = null,
  layout = null,
  zones = [],
}: {
  sectionTitle: string;
  store: StoreView;
  id: string;
  lang: Locale;
  dict: Dictionary;
  surface: ItemSurface;
  canOrderProducts: boolean;
  initialServiceId?: string | null;
  directoryOnly?: boolean;
  doctors: DoctorView[];
  providerServices: Record<string, string[]>;
  currentUser: { id: string; name: string; phone?: string } | null;
  loggedIn: boolean;
  defaultAddress: string;
  savedAddresses: { label: string; value: string }[];
  lbpRate: number;
  loyaltyPoints: number;
  branches: {
    id: string;
    name: string | null;
    area: string | null;
    address: string | null;
  }[];
  Icon: LucideIcon;
  style: { cover: string; iconWrap: string };
  initialBrand?: string | null;
  // Theme-resolved product presentation (merchant's own pick already applied).
  layout?: "grid" | "menu" | "showcase" | null;
  zones?: DeliveryZone[];
}) {
  // A store may both book services and sell goods (a vet clinic selling pet
  // food, a salon selling hair products). Items carry an explicit kind, so the
  // two are rendered by their own engine instead of one surface swallowing both
  // — which is what made products unorderable in every appointment store.
  const services = store.products.filter((p) => p.itemKind === "service");
  const goods = store.products.filter((p) => p.itemKind !== "service");
  // On an appointment surface the primary list is the services; the goods get
  // their own cart section below.
  const primary = surface === "appointment" ? services : goods;
  const showGoodsSection =
    surface === "appointment" && canOrderProducts && goods.length > 0;

  return (
    <>
      {/* Anchor target: sections that sit above this one (the clinic summary's
          "book an appointment") jump here rather than restating the engine. */}
      {/* Below lg the site header and the store's section-tab rail are both
          sticky, so the scroll margin must clear BOTH or a jump to this anchor
          lands the heading underneath them. */}
      <h2
        id="offerings"
        className="mb-4 mt-10 scroll-mt-[calc(var(--m-header-h)+var(--m-sectiontabs-h)+env(safe-area-inset-top))] text-xl font-bold lg:scroll-mt-20"
      >
        {sectionTitle}
      </h2>
      {store.isReal ? (
        primary.length ? (
          surface === "appointment" ? (
            <BookingPanel
              storeId={id}
              lang={lang}
              dict={dict}
              category={store.category}
              customerName={currentUser?.name ?? null}
              customerPhone={currentUser?.phone ?? null}
              whatsapp={store.whatsapp ?? null}
              storeName={store.name}
              hours={parseHours(store.hours)}
              slotMinutes={store.bookingSlotMinutes ?? 30}
              cancelHours={store.bookingCancelHours ?? 0}
              doctors={doctors.map((d) => ({
                id: d.id,
                name: d.name,
                specialty: d.specialty,
              }))}
              providerServices={providerServices}
              initialServiceId={initialServiceId}
              sections={store.sections}
              services={services
                .filter((p) => p.id)
                .map((p) => ({
                  id: p.id as string,
                  name: p.name,
                  nameEn: p.nameEn,
                  price: p.price,
                  imageUrl: p.imageUrl,
                  attributes: p.attributes,
                  sectionId: p.sectionId ?? null,
                  allocationMode: p.allocationMode ?? null,
                  durationMinutes: p.durationMinutes ?? null,
                  bufferMinutes: p.bufferMinutes ?? 0,
                  capacityPerSlot: p.capacityPerSlot ?? null,
                }))}
            />
          ) : surface === "order" ? (
            <StoreProducts
              storeId={id}
              lang={lang}
              dict={dict}
              category={store.category}
              isBooking={false}
              loggedIn={loggedIn}
              defaultAddress={defaultAddress}
              savedAddresses={savedAddresses}
              acceptsDelivery={store.acceptsDelivery ?? true}
              acceptsPickup={store.acceptsPickup ?? true}
              minOrder={store.minOrder ?? null}
              paymentNote={store.paymentNote ?? null}
              prepTime={store.prepTime ?? null}
              whatsapp={store.whatsapp ?? null}
              storeName={store.name}
              layout={layout ?? store.storefrontLayout}
              lbpRate={lbpRate}
              loyaltyPoints={loyaltyPoints}
              loyaltyPointsPerUnit={store.loyaltyPointsPerUnit ?? 0}
              branches={branches.map((b) => ({
                id: b.id,
                name: b.name,
                area: b.area,
                address: b.address,
              }))}
              sections={store.sections}
              products={goods
                .filter((p) => p.id)
                .map((p) => ({
                  id: p.id as string,
                  name: p.name,
                  nameEn: p.nameEn,
                  brand: p.brand ?? null,
                  price: p.price,
                  discountPrice: p.discountPrice,
                  imageUrl: p.imageUrl,
                  attributes: p.attributes,
                  stock: p.stock ?? null,
                  flashPrice: p.flashPrice,
                  flashStart: p.flashStart,
                  flashEnd: p.flashEnd,
                  sectionId: p.sectionId ?? null,
                  isBundle: p.isBundle ?? false,
                  includes: p.includes,
                }))}
              initialBrand={initialBrand}
              zones={zones}
              checkoutFields={store.checkoutFields}
            />
          ) : (
            /* Catalog surface: browse-only listing + contact via the header.
               Used by directory-only sectors (hotels/real-estate/cars/events)
               whose real transaction engine is not built yet, and by service
               sectors whose primary action is the request form above. No cart,
               no wrong booking flow. */
            <>
              {directoryOnly && (
                <div className="mb-4 rounded-xl border border-border bg-surface-muted/50 px-4 py-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    {dict.store.comingSoonNote}
                  </p>
                  {store.whatsapp && (
                    <a
                      href={waLink(
                        store.whatsapp,
                        `${dict.store.inquiryGreeting} ${store.name}`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {dict.store.contactCta}
                    </a>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {store.products
                  .filter((p) => p.id)
                  .map((p) => {
                    const attr = attributeSummary(
                      store.category,
                      p.attributes,
                      lang,
                    );
                    return (
                      <Link
                        key={p.id as string}
                        href={`/${lang}/product/${p.id}`}
                        className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-primary"
                      >
                        <span
                          className={`relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br ${style.cover}`}
                        >
                          {p.imageUrl ? (
                            <Image
                              src={p.imageUrl}
                              alt={p.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 100vw, 33vw"
                            />
                          ) : (
                            <Icon className="h-8 w-8 text-foreground/20" />
                          )}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col p-4">
                          <h3 dir="auto" className="truncate font-bold">
                            {p.name}
                          </h3>
                          {attr && (
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {attr}
                            </p>
                          )}
                          <p className="mt-2 text-sm text-muted-foreground">
                            {dict.store.from}{" "}
                            <Money value={p.price} className="font-bold text-foreground" />
                          </p>
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </>
          )
        ) : (
          <div className="rounded-2xl border border-dashed border-border py-10 sm:py-14 text-center text-muted-foreground">
            {surface === "appointment"
              ? dict.store.noServices
              : dict.store.noProducts}
          </div>
        )
      ) : null}

      {/* A booking store that also sells goods gets a real cart for them — the
          appointment engine above handles only its services. */}
      {store.isReal && showGoodsSection ? (
        <>
          <h2 className="mb-4 mt-10 text-xl font-bold">
            {dict.store.productsForSale}
          </h2>
          <StoreProducts
            storeId={id}
            lang={lang}
            dict={dict}
            category={store.category}
            isBooking={false}
            loggedIn={loggedIn}
            defaultAddress={defaultAddress}
            savedAddresses={savedAddresses}
            acceptsDelivery={store.acceptsDelivery ?? true}
            acceptsPickup={store.acceptsPickup ?? true}
            minOrder={store.minOrder ?? null}
            paymentNote={store.paymentNote ?? null}
            prepTime={store.prepTime ?? null}
            whatsapp={store.whatsapp ?? null}
            storeName={store.name}
            layout={layout ?? store.storefrontLayout}
            lbpRate={lbpRate}
            loyaltyPoints={loyaltyPoints}
            loyaltyPointsPerUnit={store.loyaltyPointsPerUnit ?? 0}
            branches={branches.map((b) => ({
              id: b.id,
              name: b.name,
              area: b.area,
              address: b.address,
            }))}
            sections={store.sections}
            products={goods
              .filter((p) => p.id)
              .map((p) => ({
                id: p.id as string,
                name: p.name,
                nameEn: p.nameEn,
                brand: p.brand ?? null,
                price: p.price,
                discountPrice: p.discountPrice,
                imageUrl: p.imageUrl,
                attributes: p.attributes,
                stock: p.stock ?? null,
                flashPrice: p.flashPrice,
                flashStart: p.flashStart,
                flashEnd: p.flashEnd,
                sectionId: p.sectionId ?? null,
                isBundle: p.isBundle ?? false,
                includes: p.includes,
              }))}
            initialBrand={initialBrand}
            zones={zones}
            checkoutFields={store.checkoutFields}
          />
        </>
      ) : null}
      {/* Demo/sample stores: a static preview grid, no transaction. */}
      {!store.isReal && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {store.products.map((p, i) => (
            <div
              key={`${p.name}-${i}`}
              className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4"
            >
              <span
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${style.cover}`}
              >
                <Icon className="h-7 w-7 text-foreground/20" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 dir="auto" className="truncate font-bold">
                  {p.name}
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {dict.store.from}{" "}
                  <Money value={p.price} className="font-bold text-foreground" />
                </p>
              </div>
              <button className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover">
                {surface === "appointment" ? dict.store.book : dict.store.order}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
