import Link from "next/link";
import { Store } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import { LanguageSwitcher } from "@/components/language-switcher";

export function SiteFooter({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const L = dict.footer.links;

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
      <Container className="py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Link href={`/${lang}`} className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Store className="h-5 w-5" />
              </span>
              <span className="text-xl font-extrabold tracking-tight">
                {dict.common.brand}
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              {dict.footer.tagline}
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-bold">{col.title}</h3>
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

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            © 2026 {dict.common.brand}. {dict.footer.rights}
          </p>
          <LanguageSwitcher currentLocale={lang} pathname={`/${lang}`} />
        </div>
      </Container>
    </footer>
  );
}
