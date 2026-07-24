import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { StoreView } from "@/lib/data/store-view";
import { parseHours } from "@/lib/hours";
import { StoreProducts } from "@/components/store-products";
import { BookingPanel } from "@/components/booking-panel";
import type { DoctorView } from "@/components/store/store-doctors";

function formatPrice(price: number) {
  return price >= 1000
    ? `$${Number(price).toLocaleString("en-US")}`
    : `$${price}`;
}

export function StoreProductsSection({
  sectionTitle,
  store,
  id,
  lang,
  dict,
  isBooking,
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
}: {
  sectionTitle: string;
  store: StoreView;
  id: string;
  lang: Locale;
  dict: Dictionary;
  isBooking: boolean;
  doctors: DoctorView[];
  providerServices: Record<string, string[]>;
  currentUser: { id: string; name: string } | null;
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
}) {
  return (
    <>
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
              doctors={doctors.map((d) => ({
                id: d.id,
                name: d.name,
                specialty: d.specialty,
              }))}
              providerServices={providerServices}
              sections={store.sections}
              services={store.products
                .filter((p) => p.id)
                .map((p) => ({
                  id: p.id as string,
                  name: p.name,
                  nameEn: p.nameEn,
                  price: p.price,
                  imageUrl: p.imageUrl,
                  attributes: p.attributes,
                  sectionId: p.sectionId ?? null,
                }))}
            />
          ) : (
            <StoreProducts
              storeId={id}
              lang={lang}
              dict={dict}
              category={store.category}
              isBooking={isBooking}
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
              layout={store.storefrontLayout}
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
              products={store.products
                .filter((p) => p.id)
                .map((p) => ({
                  id: p.id as string,
                  name: p.name,
                  nameEn: p.nameEn,
                  price: p.price,
                  discountPrice: p.discountPrice,
                  imageUrl: p.imageUrl,
                  attributes: p.attributes,
                  stock: p.stock ?? null,
                  flashPrice: p.flashPrice,
                  flashStart: p.flashStart,
                  flashEnd: p.flashEnd,
                  sectionId: p.sectionId ?? null,
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
    </>
  );
}
