import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { notFound } from "next/navigation";
import "../globals.css";
import { isLocale, locales, localeDirection } from "@/i18n/config";
import { SITE_URL } from "@/lib/site";

// Tajawal — a modern, premium typeface that covers Arabic and Latin.
const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
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
};

export const viewport: Viewport = {
  themeColor: "#1556c2",
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
      className={`${tajawal.variable} h-full`}
    >
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
