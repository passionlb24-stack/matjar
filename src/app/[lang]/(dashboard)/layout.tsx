import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink, LayoutDashboard } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutButton } from "@/components/logout-button";

// Dedicated control-panel chrome for merchants and admins — distinct from the
// customer marketplace. Logged-in only.
export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = (profile as { role?: string } | null)?.role === "super_admin";
  const name =
    ((profile as { full_name?: string } | null)?.full_name as string) ??
    user.email ??
    "";

  return (
    <div className="flex min-h-dvh flex-col bg-surface-muted/30">
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <Container className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href={`/${lang}/merchant`} className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <LayoutDashboard className="h-5 w-5" />
              </span>
              <span className="text-lg font-extrabold tracking-tight">
                {dict.dashboard.panel}
              </span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              <Link
                href={`/${lang}/merchant`}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                {dict.dashboard.stores}
              </Link>
              {isAdmin && (
                <Link
                  href={`/${lang}/admin`}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                >
                  {dict.dashboard.admin}
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href={`/${lang}`}
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted sm:flex"
            >
              <ExternalLink className="h-4 w-4" />
              {dict.dashboard.visitSite}
            </Link>
            <LanguageSwitcher currentLocale={lang} pathname={`/${lang}/merchant`} />
            <span className="hidden text-sm font-semibold sm:block">{name}</span>
            <LogoutButton label={dict.auth.logout} />
          </div>
        </Container>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
