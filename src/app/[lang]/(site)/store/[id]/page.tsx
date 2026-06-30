import { notFound } from "next/navigation";
import { MapPin, MessageCircle, Phone, Star } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { categoryStyles, getStoreById, sampleProducts } from "@/lib/catalog";
import { categoryIcons } from "@/components/category-icon";
import { Container } from "@/components/ui/container";

function formatPrice(price: number) {
  return price >= 1000 ? `$${price.toLocaleString("en-US")}` : `$${price}`;
}

const bookingCategories = new Set(["services", "healthcare", "realEstate"]);

export default async function StorePage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const store = getStoreById(id);
  if (!store) notFound();

  const dict = await getDictionary(lang);
  const Icon = categoryIcons[store.category];
  const style = categoryStyles[store.category];
  const cat = dict.catalog[store.category];
  const products = sampleProducts[store.category];
  const isBooking = bookingCategories.has(store.category);

  return (
    <div className="pb-16">
      <div className={`relative h-48 bg-gradient-to-br ${style.cover} sm:h-60`}>
        <Icon className="absolute end-10 top-10 h-28 w-28 text-black/[0.06]" />
      </div>

      <Container>
        <div className="-mt-12 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface shadow-sm">
                <span
                  className={`flex h-full w-full items-center justify-center rounded-2xl ${style.iconWrap}`}
                >
                  <Icon className="h-7 w-7" />
                </span>
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight">
                    {store.name[lang]}
                  </h1>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${store.isOpen ? "bg-emerald-600" : "bg-slate-500"}`}
                  >
                    {store.isOpen ? dict.store.openNow : dict.store.closed}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{cat.name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-bold">{store.rating.toFixed(1)}</span>
                    <span className="text-muted-foreground">
                      ({store.reviews} {dict.featured.reviews})
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {store.area[lang]}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <a
                href="#"
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-muted"
              >
                <Phone className="h-4 w-4" />
                {dict.store.call}
              </a>
              <a
                href="#"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" />
                {dict.store.whatsapp}
              </a>
            </div>
          </div>

          {store.description && (
            <p className="mt-4 border-t border-border pt-4 text-muted-foreground">
              {store.description[lang]}
            </p>
          )}
        </div>

        <h2 className="mb-4 mt-10 text-xl font-bold">{dict.store.products}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div
              key={p.name.en}
              className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4"
            >
              <span
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${style.cover}`}
              >
                <Icon className="h-7 w-7 text-black/20" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold">{p.name[lang]}</h3>
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
      </Container>
    </div>
  );
}
