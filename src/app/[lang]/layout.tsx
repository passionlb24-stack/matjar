import type { Metadata, Viewport } from "next";
import { Tajawal, Alexandria } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { notFound } from "next/navigation";
import "../globals.css";
import { isLocale, locales, localeDirection } from "@/i18n/config";
import { SITE_URL } from "@/lib/site";
import { NativeBridge } from "@/components/native-bridge";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";

// Tajawal — a modern, premium typeface that covers Arabic and Latin.
const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
});

// Alexandria — the display face. Geometric and confident in both Arabic and
// Latin; used for headings only (body stays Tajawal) to give the brand a
// recognizable typographic voice.
const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-alexandria",
});

const SITE_DESCRIPTION =
  "منصّة التجارة المحلية في لبنان — كل متجر، منتج، وخدمة بمكان واحد. Local commerce platform for Lebanon.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "متجر | Matjar",
    template: "%s · متجر",
  },
  description: SITE_DESCRIPTION,
  applicationName: "متجر · Matjar",
  openGraph: {
    type: "website",
    siteName: "متجر · Matjar",
    title: "متجر | Matjar",
    description: SITE_DESCRIPTION,
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "متجر | Matjar",
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image.png"],
  },
  manifest: "/manifest.webmanifest",
  verification: {
    google: "fRJTZiuJNv-lbiuGfanG8FAZFTV85klXdnQLiw1bXmM",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
  viewportFit: "cover",
};

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html
      lang={lang}
      dir={localeDirection[lang]}
      className={`${tajawal.variable} ${alexandria.variable} h-full`}
    >
      <head>
        {/* Apply the saved light/dark choice before paint (no theme flash). With
            no saved choice the CSS follows the OS preference. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('matjar-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}",
          }}
        />
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-M89LK69J');",
          }}
        />
      </head>
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground antialiased">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-M89LK69J"
            height={0}
            width={0}
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <ConfirmProvider>{children}</ConfirmProvider>
        <NativeBridge />
        <Analytics />
      </body>
    </html>
  );
}
