import { NextResponse, type NextRequest } from "next/server";
import { locales, defaultLocale } from "@/i18n/config";

// Next.js 16 renamed `middleware` to `proxy` (nodejs runtime only).
// This proxy ensures every request carries a locale prefix (/ar, /en).
// Lebanon-first: we default to Arabic and let visitors switch to English
// via the language toggle, rather than guessing from the browser header.

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const pathnameHasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (pathnameHasLocale) return;

  request.nextUrl.pathname = `/${defaultLocale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Run on everything except Next internals, API routes, and static files.
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
