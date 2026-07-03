import { notFound } from "next/navigation";
import { Mail, MessageCircle } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

export default async function ContactPage({
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
          {dict.footer.links.contact}
        </h1>
        <p className="mt-5 leading-8 text-muted-foreground">
          {dict.contactPage.intro}
        </p>
        <div className="mt-6 space-y-3">
          <a
            href="mailto:hello@matjarlb.com"
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 font-semibold transition-colors hover:border-primary"
          >
            <Mail className="h-5 w-5 text-primary" />
            hello@matjarlb.com
          </a>
          <a
            href="https://wa.me/9610000000"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 font-semibold transition-colors hover:border-primary"
          >
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            WhatsApp
          </a>
        </div>
      </Container>
    </div>
  );
}
