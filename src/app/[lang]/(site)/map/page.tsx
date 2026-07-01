import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getStoresForListing } from "@/lib/data/stores";
import { Container } from "@/components/ui/container";
import { StoreMapClient } from "@/components/store-map-client";
import type { MapStore } from "@/components/store-map";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.map.title, description: dict.map.subtitle };
}

export default async function MapPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const l = lang as Locale;

  const stores = await getStoresForListing();
  const mapStores: MapStore[] = stores
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => ({
      id: s.id,
      name: s.name[l],
      lat: s.lat as number,
      lng: s.lng as number,
    }));

  return (
    <div className="py-10">
      <Container>
        <div className="flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {dict.map.title}
          </h1>
        </div>
        <p className="mt-2 text-muted-foreground">{dict.map.subtitle}</p>

        <div className="mt-6">
          {mapStores.length ? (
            <StoreMapClient stores={mapStores} lang={l} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
              {dict.map.empty}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
