import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Truck, Phone, MessageCircle, MapPin } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { localeAlternates } from "@/lib/site";
import { Container } from "@/components/ui/container";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.delivery.title,
    description: dict.delivery.subtitle,
    alternates: localeAlternates(lang, "/delivery"),
  };
}

type Company = {
  id: string;
  name: string;
  coverage: string | null;
  phone: string | null;
  whatsapp: string | null;
  pricing_note: string | null;
};

export default async function DeliveryPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.delivery;

  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_companies")
    .select("id, name, coverage, phone, whatsapp, pricing_note")
    .eq("is_active", true)
    .order("name", { ascending: true });
  const companies = (data ?? []) as Company[];

  return (
    <div className="py-10">
      <Container className="max-w-3xl">
        <div className="flex items-center gap-2">
          <Truck className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
        </div>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>

        {companies.length ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {companies.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <h2 className="font-bold">{c.name}</h2>
                {c.coverage && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {c.coverage}
                  </p>
                )}
                {c.pricing_note && (
                  <p className="mt-1 text-sm font-semibold text-primary">
                    {c.pricing_note}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.whatsapp && (
                    <a
                      href={`https://wa.me/${c.whatsapp.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {dict.store.whatsapp}
                    </a>
                  )}
                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-muted"
                    >
                      <Phone className="h-4 w-4" />
                      {dict.store.call}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Truck className="h-7 w-7" />
            </span>
            <p className="mt-4 text-muted-foreground">{t.empty}</p>
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-primary/30 bg-primary-soft/40 p-5 text-center">
          <p className="font-bold">{t.joinTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t.joinBody}</p>
        </div>
      </Container>
    </div>
  );
}
