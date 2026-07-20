import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Mail, MessageCircle } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { Container } from "@/components/ui/container";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const title = lang === "ar" ? "تواصل معنا" : "Contact us";
  const description =
    lang === "ar"
      ? "عندك سؤال أو اقتراح؟ تواصل مع فريق متجر."
      : "Have a question or feedback? Get in touch with the Matjar team.";
  return { title, description, alternates: localeAlternates(lang, "/contact") };
}

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
        <div data-animate>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {dict.footer.links.contact}
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            {dict.contactPage.intro}
          </p>
          <div className="mt-8 space-y-3">
            <a
              href="mailto:hello@matjarlb.com"
              className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Mail className="h-5 w-5" />
              </span>
              <span className="font-semibold">hello@matjarlb.com</span>
            </a>
            <a
              href="https://wa.me/9610000000"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
                <MessageCircle className="h-5 w-5" />
              </span>
              <span className="font-semibold">WhatsApp</span>
            </a>
          </div>
        </div>
      </Container>
    </div>
  );
}
