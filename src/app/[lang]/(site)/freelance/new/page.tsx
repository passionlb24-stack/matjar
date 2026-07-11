import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { GigForm } from "@/components/gig-form";

export default async function NewGigPage({
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const freelancerName =
    (profile as { full_name: string | null } | null)?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    "";

  return (
    <div className="py-10">
      <Container className="max-w-xl">
        <Link
          href={`/${lang}/freelance`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {dict.freelance.title}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          {dict.freelance.offerService}
        </h1>
        <div className="mt-6">
          <GigForm lang={lang} dict={dict} freelancerName={freelancerName} />
        </div>
      </Container>
    </div>
  );
}
