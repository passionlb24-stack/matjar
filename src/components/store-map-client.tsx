"use client";

import dynamic from "next/dynamic";
import type { Locale } from "@/i18n/config";
import type { MapStore } from "@/components/store-map";

// Leaflet touches `window` at import time, so load the map only on the client.
const StoreMap = dynamic(
  () => import("@/components/store-map").then((m) => m.StoreMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[70vh] w-full animate-pulse rounded-2xl border border-border bg-surface-muted" />
    ),
  },
);

export function StoreMapClient({
  stores,
  lang,
  heightClass,
}: {
  stores: MapStore[];
  lang: Locale;
  heightClass?: string;
}) {
  return <StoreMap stores={stores} lang={lang} heightClass={heightClass} />;
}
