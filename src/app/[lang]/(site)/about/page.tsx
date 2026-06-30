import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div className="py-14">
      <Container className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {dict.footer.links.about}
        </h1>
        <p className="mt-5 leading-8 text-muted-foreground">
          {lang === "ar"
            ? "متجر هي منصّة التجارة المحلية في لبنان — مكان واحد يجمع المتاجر والمنتجات والخدمات، ويساعد أصحاب الأعمال يوصلوا لعملائهم بسهولة. هدفنا نخلّي التسوّق والحجز المحلي أسرع وأسهل، ونعطي كل تاجر متجره الإلكتروني خلال دقائق."
            : "Matjar is Lebanon's local commerce platform — one place that brings together stores, products, and services, helping business owners reach their customers with ease. Our goal is to make local shopping and booking faster and simpler, and to give every merchant their own online store in minutes."}
        </p>
      </Container>
    </div>
  );
}
