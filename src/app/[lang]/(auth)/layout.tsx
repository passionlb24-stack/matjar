import Link from "next/link";
import { Store } from "lucide-react";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <Container className="flex h-16 items-center justify-between">
          <Link href={`/${lang}`} className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Store className="h-5 w-5" />
            </span>
            <span className="text-xl font-extrabold tracking-tight">
              {dict.common.brand}
            </span>
          </Link>
          <ThemeToggle />
          <LanguageSwitcher currentLocale={lang} />
        </Container>
      </header>
      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
