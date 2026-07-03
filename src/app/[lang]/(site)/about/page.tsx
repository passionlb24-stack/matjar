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
          {dict.aboutPage.body}
        </p>
      </Container>
    </div>
  );
}
