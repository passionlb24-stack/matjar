import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Plus, ImageIcon, Package } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
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
        <div className="mt-3 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">{t.myListings}</h1>
          <Link
            href={`/${lang}/wholesale/new`}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" />
            {t.listProduct}
          </Link>
        </div>

        {items.length ? (
          <div className="mt-8 space-y-3">
            {items.map((w) => (
              <Link
                key={w.id}
                href={`/${lang}/wholesale/${w.id}`}
                className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary"
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
                    <ImageIcon className="h-6 w-6 text-black/10" />
                  </div>
                )}
                <div>
                  <p className="font-bold">{w.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {w.status === "active" ? t.statusActive : t.statusPaused}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState className="mt-8" icon={Package} title={t.noListings} />
        )}
      </Container>
    </div>
  );
}
