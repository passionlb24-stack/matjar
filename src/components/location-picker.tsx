"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, Loader2 } from "lucide-react";

// Draggable-pin location picker for the merchant to set their store's exact
// coordinates (not just a typed address). Free OpenStreetMap via vanilla
// Leaflet (React 19 / Next 16 friendly). Load this via next/dynamic ssr:false —
// Leaflet touches `window` at import time.
export function LocationPicker({
  value,
  onChange,
  hint,
  locateLabel,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (v: { lat: number; lng: number }) => void;
  hint?: string;
  locateLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const start: [number, number] = value
      ? [value.lat, value.lng]
      : [33.8547, 35.8623]; // Lebanon
    const map = L.map(ref.current, { scrollWheelZoom: false }).setView(
      start,
      value ? 15 : 8,
    );
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const pin = L.divIcon({
      className: "",
      html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#1556c2;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);transform:rotate(-45deg)"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 22],
    });

    const marker = L.marker(start, { icon: pin, draggable: true }).addTo(map);
    markerRef.current = marker;
    if (!value) marker.setOpacity(0); // hidden until the merchant places it

    const set = (lat: number, lng: number) => {
      marker.setLatLng([lat, lng]).setOpacity(1);
      onChangeRef.current({
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
      });
    };
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      set(p.lat, p.lng);
    });
    map.on("click", (e: L.LeafletMouseEvent) => set(e.latlng.lat, e.latlng.lng));

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const map = mapRef.current;
        const marker = markerRef.current;
        if (map && marker) {
          map.setView([lat, lng], 16);
          marker.setLatLng([lat, lng]).setOpacity(1);
          onChangeRef.current({
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
          });
        }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div>
      <div className="relative">
        <div
          ref={ref}
          className="h-64 w-full overflow-hidden rounded-2xl border border-border"
        />
        <button
          type="button"
          onClick={locate}
          className="absolute end-3 top-3 z-[500] inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-sm font-bold text-primary shadow-md transition-colors hover:bg-surface-muted"
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LocateFixed className="h-4 w-4" />
          )}
          {locateLabel}
        </button>
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
