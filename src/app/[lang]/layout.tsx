import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { isLocale, locales, localeDirection } from "@/i18n/config";

// Tajawal — a modern, premium typeface that covers Arabic and Latin.
const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
});

export const metadata: Metadata = {
  title: {
    default: "متجر | Matjar",
    template: "%s · متجر",
  },
  description:
    "منصّة التجارة المحلية في لبنان — كل متجر، منتج، وخدمة بمكان واحد. Local commerce platform for Lebanon.",
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
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
