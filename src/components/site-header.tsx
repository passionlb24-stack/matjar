import Link from "next/link";
import Image from "next/image";
import { User } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";
import { MobileMenu } from "@/components/mobile-menu";
import { NavDropdown } from "@/components/nav-dropdown";
import { NavLink } from "@/components/nav-link";
import { HeaderBells } from "@/components/header-bells";
import { HeaderSearch } from "@/components/header-search";

export function SiteHeader({
  lang,
  dict,
  user,
  unread = 0,
  unreadMessages = 0,
  dashboardHref = null,
  lbpRate = 0,
}: {
  lang: Locale;
  dict: Dictionary;
  user: { name: string } | null;
  unread?: number;
  unreadMessages?: number;
  dashboardHref?: string | null;
  lbpRate?: number;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-md print:hidden">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href={`/${lang}`} className="flex items-center" aria-label={dict.common.brand}>
            <Image
              src="/logo.png"
              alt={dict.common.brand}
              width={450}
              height={182}
              priority
              unoptimized
              className="h-9 w-auto object-contain"
            />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink
              href={`/${lang}/explore`}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground aria-[current=page]:bg-surface-muted aria-[current=page]:text-foreground"
            >
              {dict.common.explore}
            </NavLink>
            <NavLink
              href={`/${lang}/market`}
              className="rounded-lg px-3 py-2 text-sm font-bold text-primary transition-colors hover:bg-surface-muted aria-[current=page]:bg-primary-soft"
            >
              {dict.market.nav}
            </NavLink>
            <NavDropdown
              label={dict.common.deals}
              items={[
                { href: `/${lang}/offers`, label: dict.offers.title },
                { href: `/${lang}/flash`, label: dict.flash.title, accent: true },
                { href: `/${lang}/best-sellers`, label: dict.bestSellers.title },
              ]}
            />
            <NavDropdown
              label={dict.common.workServices}
              items={[
                { href: `/${lang}/jobs`, label: dict.jobs.title },
                { href: `/${lang}/freelance`, label: dict.freelance.title },
                { href: `/${lang}/wholesale`, label: dict.wholesale.title },
                { href: `/${lang}/delivery`, label: dict.delivery.title },
              ]}
            />
            <NavLink
              href={`/${lang}/hub`}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground aria-[current=page]:bg-surface-muted aria-[current=page]:text-foreground"
            >
              {dict.common.hub}
            </NavLink>
            <NavLink
              href={`/${lang}/merchants`}
              className="rounded-lg px-3 py-2 text-sm font-bold text-primary transition-colors hover:bg-surface-muted aria-[current=page]:bg-primary-soft"
            >
              {dict.common.forMerchants}
            </NavLink>
            <NavLink
              href={`/${lang}/map`}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground aria-[current=page]:bg-surface-muted aria-[current=page]:text-foreground"
            >
              {dict.map.title}
            </NavLink>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          {/* Bells stay visible for signed-in users even on a phone. */}
          {user && (
            <HeaderBells
              lang={lang}
              dict={dict}
              unreadNotifications={unread}
              unreadMessages={unreadMessages}
            />
          )}
          {/* Full controls on tablet/desktop; on a phone these move into the ☰
              menu so the bar can never overflow. */}
          <div className="hidden items-center gap-2 md:flex md:gap-3">
            {/* Daily habit hook: Lebanese users check the USD rate constantly. */}
            {lbpRate > 0 && (
              <span
                title={dict.common.rateTitle}
                className="hidden whitespace-nowrap rounded-full bg-surface-muted px-3 py-1.5 text-xs font-bold text-muted-foreground lg:block"
              >
                $1 = {lbpRate.toLocaleString("en-US")}{" "}
                {lang === "ar" ? "ل.ل." : "LBP"}
              </span>
            )}
            <ThemeToggle />
            <LanguageSwitcher currentLocale={lang} />
            {user ? (
              <>
                {dashboardHref && (
                  <Link
                    href={dashboardHref}
                    className="rounded-lg px-3 py-2 text-sm font-bold text-primary transition-colors hover:bg-surface-muted"
                  >
                    {dict.dashboard.panel}
                  </Link>
                )}
                <Link
                  href={`/${lang}/account`}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-surface-muted"
                >
                  <User className="h-4 w-4 text-primary" />
                  {user.name}
                </Link>
                <LogoutButton label={dict.auth.logout} />
              </>
            ) : (
              <Link
                href={`/${lang}/login`}
                className="rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-surface-muted"
              >
                {dict.common.login}
              </Link>
            )}
          </div>
          {/* Open-store is the primary guest CTA — keep it visible always. */}
          {!user && (
            <Link
              href={`/${lang}/merchant/new`}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover sm:px-4"
            >
              {dict.common.openStore}
            </Link>
          )}
          <MobileMenu
            lang={lang}
            dict={dict}
            user={user}
            dashboardHref={dashboardHref}
            lbpRate={lbpRate}
          />
        </div>
      </Container>
      <HeaderSearch lang={lang} dict={dict} />
    </header>
  );
}
