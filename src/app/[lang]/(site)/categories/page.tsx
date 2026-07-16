import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { Container } from "@/components/ui/container";
import { CategoryGrid } from "@/components/category-grid";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const title = lang === "ar" ? "التصنيفات" : "Categories";
  const description =
    lang === "ar"
      ? "تصفّح متاجر وخدمات لبنان حسب التصنيف: مطاعم، محلات، عيادات، عقارات، سيارات وأكثر."
      : "Browse Lebanon's stores and services by category: restaurants, retail, clinics, real estate, automotive and more.";
  return { title, description, alternates: localeAlternates(lang, "/categories") };
}

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div className="pt-8">
      <Container>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {lang === "ar" ? "التصنيفات" : "Categories"}
        </h1>
      </Container>
      <CategoryGrid lang={lang} dict={dict} />
    </div>
  );
}
