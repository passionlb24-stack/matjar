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
        { label: L.openStore, href: `/${lang}/merchant/new` },
        { label: L.pricing, href: `/${lang}/pricing` },
        { label: L.merchantLogin, href: `/${lang}/login` },
      ],
    },
    {
      title: dict.footer.companyTitle,
      links: [
        { label: L.about, href: `/${lang}/about` },
        { label: L.help, href: `/${lang}/help` },
        { label: L.contact, href: `/${lang}/contact` },
        { label: L.privacy, href: `/${lang}/privacy` },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-surface print:hidden">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
          {/* Brand + app */}
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

            <p className="mt-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">
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
                    <span className="block text-[10px] text-muted-foreground">
                      {b.top}
                    </span>
                    <span className="block text-[13px] font-extrabold">
                      {b.name}
                    </span>
                  </span>
                  <span className="absolute -end-1.5 -top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-extrabold text-primary-foreground">
                    {soon}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
