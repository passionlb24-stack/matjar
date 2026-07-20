import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Plus, ImageIcon, Package } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MyWholesalePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.wholesale;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data } = await supabase
    .from("wholesale_products")
    .select("id, title, status, image_url")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });
  const items = (data ?? []) as {
    id: string;
    title: string;
    status: string;
    image_url: string | null;
  }[];

  return (
    <div className="py-10">
      <Container className="max-w-2xl">
        <Link
          href={`/${lang}/wholesale`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {t.title}
        </Link>
        <PageHeader
          className="mt-3"
          title={t.myListings}
          icon={Package}
          actions={
            <ButtonLink
              href={`/${lang}/wholesale/new`}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              {t.listProduct}
            </ButtonLink>
          }
        />

        {items.length ? (
          <div data-animate className="mt-6 space-y-3">
            {items.map((w) => (
              <Card
                key={w.id}
                variant="interactive"
                className="relative flex items-center gap-4 p-4"
              >
                {w.image_url ? (
                  <Image
                    src={w.image_url}
                    alt={w.title}
                    width={64}
                    height={64}
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-surface-muted">
                    <ImageIcon className="h-6 w-6 text-foreground/10" />
                  </div>
                )}
                <div>
                  <p className="font-bold">{w.title}</p>
                  <p className="mt-1">
                    <Badge
                      variant={w.status === "active" ? "success" : "neutral"}
                      size="sm"
                    >
                      {w.status === "active" ? t.statusActive : t.statusPaused}
                    </Badge>
                  </p>
                </div>
                <Link
                  href={`/${lang}/wholesale/${w.id}`}
                  aria-label={w.title}
                  className="absolute inset-0"
                />
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState className="mt-8" icon={Package} title={t.noListings} />
        )}
      </Container>
    </div>
  );
}
