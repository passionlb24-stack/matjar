import { NextResponse, type NextRequest } from "next/server";
import { locales, defaultLocale } from "@/i18n/config";

// Next.js 16 renamed `middleware` to `proxy` (nodejs runtime only).
// This proxy ensures every request carries a locale prefix (/ar, /en).

function getLocale(request: NextRequest): string {
  const acceptLang = request.headers.get("accept-language");
  if (!acceptLang) return defaultLocale;

  // Parse "en-US,en;q=0.9,ar;q=0.8" into ordered base languages.
  const preferred = acceptLang
    .split(",")
    .map((part) => part.split(";")[0].trim().toLowerCase().split("-")[0]);

  for (const lang of preferred) {
    const match = locales.find((locale) => locale === lang);
    if (match) return match;
  }
  return defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const pathnameHasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (pathnameHasLocale) return;

  const locale = getLocale(request);
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Run on everything except Next internals, API routes, and static files.
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
