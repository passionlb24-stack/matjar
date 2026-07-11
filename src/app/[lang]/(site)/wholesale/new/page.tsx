import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { WholesaleForm } from "@/components/wholesale-form";

export default async function NewWholesalePage({
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

  const { data: store } = await supabase
    .from("stores")
    .select("name")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const sellerName =
    (store as { name: string } | null)?.name ??
    (profile as { full_name: string | null } | null)?.full_name ??
    "";

  return (
    <div className="py-10">
      <Container className="max-w-xl">
        <Link
          href={`/${lang}/wholesale`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {dict.wholesale.title}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          {dict.wholesale.listProduct}
        </h1>
        <div className="mt-6">
          <WholesaleForm lang={lang} dict={dict} sellerName={sellerName} />
        </div>
      </Container>
    </div>
  );
}
