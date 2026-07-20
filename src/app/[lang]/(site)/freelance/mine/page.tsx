import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Plus, ImageIcon, Sparkles } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MyGigsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.freelance;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data } = await supabase
    .from("gigs")
    .select("id, title, status, image_url")
    .eq("freelancer_id", user.id)
    .order("created_at", { ascending: false });
  const gigs = (data ?? []) as {
    id: string;
    title: string;
    status: string;
    image_url: string | null;
  }[];

  return (
    <div className="py-10">
      <Container className="max-w-2xl">
        <Link
          href={`/${lang}/freelance`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {t.title}
        </Link>
        <PageHeader
          className="mt-3"
          title={t.myGigs}
          icon={Sparkles}
          actions={
            <ButtonLink
              href={`/${lang}/freelance/new`}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              {t.offerService}
            </ButtonLink>
          }
        />

        {gigs.length ? (
          <div data-animate className="mt-6 space-y-3">
            {gigs.map((g) => (
              <Card
                key={g.id}
                variant="interactive"
                className="relative flex items-center gap-4 p-4"
              >
                {g.image_url ? (
                  <Image
                    src={g.image_url}
                    alt={g.title}
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
                  <p className="font-bold">{g.title}</p>
                  <p className="mt-1">
                    <Badge
                      variant={g.status === "active" ? "success" : "neutral"}
                      size="sm"
                    >
                      {g.status === "active" ? t.statusActive : t.statusPaused}
                    </Badge>
                  </p>
                </div>
                <Link
                  href={`/${lang}/freelance/${g.id}`}
                  aria-label={g.title}
                  className="absolute inset-0"
                />
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState className="mt-8" icon={Sparkles} title={t.noGigs} />
        )}
      </Container>
    </div>
  );
}
