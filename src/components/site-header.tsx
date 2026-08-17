import Link from "next/link";
import { dictSlice } from "@/lib/dict-slice";
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
import { MobileSearch } from "@/components/mobile-search";

export function SiteHeader({
  lang,
  dict,
  user,
  userId = null,
  unread = 0,
  unreadMessages = 0,
  dashboardHref = null,
  lbpRate = 0,
}: {
  lang: Locale;
  dict: Dictionary;
  user: { name: string } | null;
  userId?: string | null;
  unread?: number;
  unreadMessages?: number;
  dashboardHref?: string | null;
  lbpRate?: number;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-md print:hidden">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link
            href={`/${lang}`}
            aria-label={dict.common.brand}
            /* The mark stays 36px; the tap area is extended to 44 with a
               transparent pseudo-element — the same trick ui/button uses for
               its sm size, so the header does not have to get taller. */
            className="relative flex items-center before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']"
          >
            <Image
              src="/logo.png"
              alt={dict.common.brand}
              width={450}
              height={182}
              priority
              unoptimized
              className="h-9 w-auto max-w-none object-contain"
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
                // Beside freelance on purpose, and deliberately not the same
                // thing: that one is remote and digital, this one comes to your
                // house.
                { href: `/${lang}/crafts`, label: dict.crafts.title },
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
        {/* KNOWN: this row overflows its container at every desktop width, and
            escapes the viewport as ~6px of horizontal page scroll around 1280px,
            where the mx-auto slack is narrowest. Measured in a live browser:
            max-w-6xl + lg:px-8 leaves 1088px of content space; the nav is 621px,
            this group is 545px, the gap is 16px — 1182px needed.
            It is NOT a spacing bug and min-w-0 does not fix it (tried, measured,
            reverted). The row simply carries more than it has room for: seven nav
            items from md upward, plus five actions. Fixing it means dropping nav
            items into the overflow menu or shrinking this group — a visible
            change to the header of every page, so it is recorded rather than
            guessed at from a terminal. */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          {/* Bells stay visible for signed-in users even on a phone. */}
          {user && (
            <HeaderBells
              lang={lang}
              dict={dictSlice(dict, ["common"])}
              userId={userId}
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
              className="relative rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground transition-colors before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] hover:bg-primary-hover sm:px-4"
            >
              {dict.common.openStore}
            </Link>
          )}
          <MobileMenu
            lang={lang}
            dict={dictSlice(dict, ["auth", "bestSellers", "common", "dashboard", "delivery", "flash", "freelance", "jobs", "map", "market", "mobileNav", "offers", "pricing", "wholesale"])}
            user={user}
            dashboardHref={dashboardHref}
            lbpRate={lbpRate}
          />
        </div>
      </Container>

      {/* Phones get search as its own screen; desktop keeps the sticky field,
          which works fine at that width. Both routes end at /search. */}
      <Container className="pb-2.5 lg:hidden">
        <MobileSearch
          lang={lang}
          labels={{
            open: dict.search.openSearch,
            placeholder: dict.hero.searchPlaceholder,
            recent: dict.search.recent,
            clear: dict.search.clear,
            back: dict.common.back,
          }}
        />
      </Container>

      <HeaderSearch lang={lang} dict={dictSlice(dict, ["hero"])} />
    </header>
  );
}
