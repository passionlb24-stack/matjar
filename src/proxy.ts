import { NextResponse, type NextRequest } from "next/server";
import { locales, defaultLocale } from "@/i18n/config";
import { updateSession } from "@/lib/supabase/proxy-session";

// Next.js 16 renamed `middleware` to `proxy` (nodejs runtime only).
// Ensures every request carries a locale prefix (/ar, /en) and keeps the
// Supabase session fresh. Lebanon-first: default to Arabic, switch via toggle.

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const pathnameHasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  if (!pathnameHasLocale) {
    request.nextUrl.pathname = `/${defaultLocale}${pathname}`;
    return NextResponse.redirect(request.nextUrl);
  }

  return updateSession(request);
}

export const config = {
  // Run on everything except Next internals, API routes, and static files.
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
