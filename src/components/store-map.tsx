"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Locale } from "@/i18n/config";

export type MapStore = {
  id: string;
  name: string;
  // Branch name/area label — set only when the store has 2+ branches, so
  // multi-branch pins are distinguishable while single stores stay unchanged.
  branch?: string | null;
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
      // Build the popup as DOM nodes with textContent — store/branch names are
      // merchant-controlled, so interpolating them into an HTML string would be
      // a stored-XSS sink (Leaflet renders bindPopup strings as innerHTML).
      const popup = document.createElement("div");
      const link = document.createElement("a");
      link.href = `/${lang}/store/${s.id}`;
      link.style.cssText =
        "font-weight:700;color:#1556c2;text-decoration:none";
      link.textContent = s.name;
      popup.appendChild(link);
      if (s.branch) {
        const sub = document.createElement("div");
        sub.style.cssText = "color:#64748b;font-size:12px;margin-top:2px";
        sub.textContent = s.branch;
        popup.appendChild(sub);
      }
      const m = L.marker([s.lat, s.lng], { icon: pin })
        .addTo(map)
        .bindPopup(popup);
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
