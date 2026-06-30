import { notFound, redirect } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { regions } from "@/lib/catalog";
import { Container } from "@/components/ui/container";
import { StoreForm } from "@/components/store-form";

type BusinessTypeRow = {
  id: string;
  name_ar: string;
  name_en: string;
};

export default async function NewStorePage({
  params,
}: {
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

  const { data: types } = await supabase
    .from("business_types")
    .select("id, name_ar, name_en")
    .order("sort_order");

  const businessTypes = ((types ?? []) as BusinessTypeRow[]).map((t) => ({
    value: t.id,
    label: lang === "ar" ? t.name_ar : t.name_en,
  }));
  const regionOptions = regions.map((r) => ({
    value: r.key,
    label: r.name[lang as Locale],
  }));

  return (
    <div className="py-10">
      <Container className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {dict.merchant.createTitle}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {dict.merchant.createSubtitle}
        </p>
        <div className="mt-6">
          <StoreForm
            lang={lang}
            dict={dict}
            businessTypes={businessTypes}
            regions={regionOptions}
          />
        </div>
      </Container>
    </div>
  );
}
