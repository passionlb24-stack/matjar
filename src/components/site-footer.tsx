import Link from "next/link";
import { Store, Smartphone } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import { LanguageSwitcher } from "@/components/language-switcher";

export function SiteFooter({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const L = dict.footer.links;
  const soon = lang === "ar" ? "قريباً" : "Soon";

  const columns = [
    {
      title: dict.mobileNav.shop,
      links: [
        { label: L.stores, href: `/${lang}/explore` },
        { label: L.categories, href: `/${lang}/categories` },
        { label: dict.market.nav, href: `/${lang}/market` },
        { label: L.offers, href: `/${lang}/offers` },
        { label: dict.flash.title, href: `/${lang}/flash` },
        { label: dict.bestSellers.title, href: `/${lang}/best-sellers` },
      ],
    },
    {
      title: dict.common.workServices,
      links: [
        { label: dict.jobs.title, href: `/${lang}/jobs` },
        { label: dict.freelance.title, href: `/${lang}/freelance` },
        { label: dict.wholesale.title, href: `/${lang}/wholesale` },
        { label: dict.delivery.title, href: `/${lang}/delivery` },
        { label: dict.map.title, href: `/${lang}/map` },
      ],
    },
    {
      title: dict.footer.merchantsTitle,
      links: [
        { label: dict.common.forMerchants, href: `/${lang}/merchants` },
        { label: L.openStore, href: `/${lang}/merchant/new` },
        { label: dict.common.hub, href: `/${lang}/hub` },
        { label: L.pricing, href: `/${lang}/pricing` },
        { label: L.merchantLogin, href: `/${lang}/login` },
      ],
    },
    {
      title: dict.footer.companyTitle,
      links: [
        { label: L.about, href: `/${lang}/about` },
        { label: dict.trustPage.metaTitle, href: `/${lang}/trust` },
        { label: L.help, href: `/${lang}/help` },
        { label: L.contact, href: `/${lang}/contact` },
        { label: L.privacy, href: `/${lang}/privacy` },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-surface print:hidden">
      <Container className="py-10 sm:py-14">
        {/* One column on phones, five from `md`. The app block is a separate
            cell so the single-column stack can end with it — see below. It is
            pinned back to column 1 / row 2 at `md`, and the row gap there is
            the 24px it used to get from its own `mt-6`, so the desktop footer
            is byte-for-byte where it was. `1fr` on row 2 absorbs any extra
            height the row-spanning link columns need, keeping row 1 — and so
            the app block's top edge — exactly under the tagline. */}
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr_1fr] md:grid-rows-[auto_1fr] md:gap-y-6">
          <div>
            <Link href={`/${lang}`} className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-hover text-primary-foreground shadow-md">
                <Store className="h-5 w-5" />
              </span>
              <span className="text-xl font-extrabold tracking-tight">
                {dict.common.brand}
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {dict.footer.tagline}
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title} className="md:row-span-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {col.title}
              </h3>
              {/* Links carry vertical padding so the touch target clears 44px
                  (WCAG 2.5.5) — measured at 20px before. The negative inline
                  margin keeps the text where it was, so only the hit area grows. */}
              <ul className="mt-3 space-y-0.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="-mx-2 inline-flex min-h-11 items-center px-2 text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Two "Soon" badges for apps nobody can install yet were the first
              thing under the brand on a phone — above every link the footer
              actually exists to serve. Last child, so the mobile stack reaches
              them only after the navigation. */}
          <div className="md:col-start-1 md:row-start-2 md:self-start">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {dict.footer.appTitle}
            </p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {[
                { top: dict.footer.downloadOn, name: dict.footer.appStore },
                { top: dict.footer.getItOn, name: dict.footer.googlePlay },
              ].map((b) => (
                <span
                  key={b.name}
                  className="relative flex items-center gap-2.5 rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2"
                >
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <span className="leading-tight">
                    {/* 12px is the floor for Arabic: below it the harakat and
                        the dots that separate ب ت ث stop resolving on a phone. */}
                    <span className="block text-xs text-muted-foreground">
                      {b.top}
                    </span>
                    <span className="block text-[13px] font-extrabold">
                      {b.name}
                    </span>
                  </span>
                  <span className="absolute -end-1.5 -top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-extrabold text-primary-foreground">
                    {soon}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            © 2026 {dict.common.brand}. {dict.footer.rights}
          </p>
          <LanguageSwitcher currentLocale={lang} />
        </div>
      </Container>
    </footer>
  );
}
