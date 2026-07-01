"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Locale } from "@/i18n/config";

export type MapStore = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

// Free OpenStreetMap map (no API key). Vanilla Leaflet via a ref so it works
// with React 19 / Next 16 without react-leaflet's peer-dep constraints.
export function StoreMap({
  stores,
  lang,
}: {
  stores: MapStore[];
  lang: Locale;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: false }).setView(
      [33.8547, 35.8623], // Lebanon
      8,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const pin = L.divIcon({
      className: "",
      html: '<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;background:#1556c2;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:rotate(-45deg)"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 20],
      popupAnchor: [0, -18],
    });

    const markers: L.Marker[] = [];
    for (const s of stores) {
      const m = L.marker([s.lat, s.lng], { icon: pin })
        .addTo(map)
        .bindPopup(
          `<a href="/${lang}/store/${s.id}" style="font-weight:700;color:#1556c2;text-decoration:none">${s.name}</a>`,
        );
      markers.push(m);
    }
    if (markers.length) {
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.2));
    }

    return () => {
      map.remove();
    };
  }, [stores, lang]);

  return (
    <div
      ref={ref}
      className="h-[70vh] w-full overflow-hidden rounded-2xl border border-border"
    />
  );
}
