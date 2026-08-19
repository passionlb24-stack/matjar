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
    // Real files at each declared size, not one 512 declared three times
    // (MP-031). Three assets because they are three different jobs:
    //
    //   icon-192      what Android's launcher actually requests; the 512 used
    //                 to be declared at 192 and downscaled on every draw.
    //   icon-512      the install prompt and splash size.
    //   maskable-512  NOT the same image. Android masks a maskable icon to an
    //                 arbitrary shape and the only guaranteed-visible region is
    //                 the centre circle at 80% of the canvas. The square "any"
    //                 asset puts the shop's awning outside that circle, so a
    //                 circular mask sliced the roof off. This one is the same
    //                 mark re-laid-out so its diagonal fits the safe circle, on
    //                 an edge-to-edge opaque ground (a mask over transparency
    //                 cuts a hole, not a silhouette).
    //
    // Generated from the 512 master at src/app/icon.png with sharp. The
    // apple-touch-icon (src/app/apple-icon.png, emitted by Next's file
    // convention) is a real 180 now instead of a byte copy of the 512.
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
