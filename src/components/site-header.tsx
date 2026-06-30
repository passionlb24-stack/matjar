import Link from "next/link";
import { Store, User } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutButton } from "@/components/logout-button";

export function SiteHeader({
  lang,
  dict,
  user,
}: {
  lang: Locale;
  dict: Dictionary;
  user: { name: string } | null;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href={`/${lang}`} className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Store className="h-5 w-5" />
            </span>
            <span className="text-xl font-extrabold tracking-tight">
              {dict.common.brand}
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href={`/${lang}/explore`}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              {dict.common.explore}
            </Link>
            <Link
              href={`/${lang}/merchants`}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              {dict.common.forMerchants}
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher currentLocale={lang} pathname={`/${lang}`} />
          {user ? (
            <>
              <Link
                href={`/${lang}/account`}
                className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-surface-muted sm:flex"
              >
                <User className="h-4 w-4 text-primary" />
                {user.name}
              </Link>
              <LogoutButton label={dict.auth.logout} />
            </>
          ) : (
            <>
              <Link
                href={`/${lang}/login`}
                className="hidden rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-surface-muted sm:block"
              >
                {dict.common.login}
              </Link>
              <Link
                href={`/${lang}/merchant/new`}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                {dict.common.openStore}
              </Link>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}
