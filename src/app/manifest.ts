import type { MetadataRoute } from "next";

// PWA manifest — enables "Add to Home Screen" on mobile (Lebanon is mobile-first)
// and sets the browser-chrome / splash colors to the brand blue.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "متجر · Matjar",
    short_name: "متجر",
    description: "منصّة التجارة المحلية في لبنان — كل متجر، منتج، وخدمة بمكان واحد.",
    start_url: "/ar",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1556c2",
    dir: "rtl",
    lang: "ar",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
