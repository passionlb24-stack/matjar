import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { CraftRequestForm } from "@/components/crafts/craft-request-form";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Asking a specific tradesman to come.
//
// Open to guests on purpose. Requiring an account here would lose most of this
// market — the person whose water is running down the wall is not making an
// account first — and the RLS policy is written to allow exactly that while
// making it impossible to file a request under someone else's name.
export default async function CraftRequestPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(id)) notFound();

  const dict = await getDictionary(lang);
  const t = dict.crafts;

  const supabase = await createClient();
  const [{ data: provider }, { data: areas }, { data: auth }] = await Promise.all([
    supabase
      .from("craft_providers")
      .select("id, name, headline, status")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("lb_areas")
      .select("id, region, name_ar, name_en")
      .order("sort_order"),
    supabase.auth.getUser(),
  ]);

  const p = provider as { id: string; name: string; headline: string | null; status: string } | null;
  if (!p || p.status !== "active") notFound();

  // Prefill from the account so a signed-in customer never retypes what we
  // already hold. A guest just gets empty fields.
  const user = auth?.user ?? null;
  let defaultName = "";
  let defaultPhone = "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .maybeSingle();
    const pr = profile as { full_name: string | null; phone: string | null } | null;
    defaultName = pr?.full_name ?? "";
    defaultPhone = pr?.phone ?? "";
  }

  return (
    <div className="py-8 sm:py-10">
      <Container className="max-w-xl">
        <Link
          href={`/${lang}/crafts/p/${p.id}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {p.name}
        </Link>

        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">
          {t.reqTitle.replace("{name}", p.name)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.reqSubtitle}</p>

        <div className="mt-6">
          <CraftRequestForm
            providerId={p.id}
            providerName={p.name}
            lang={lang}
            userId={user?.id ?? null}
            defaultName={defaultName}
            defaultPhone={defaultPhone}
            areas={(areas ?? []) as {
              id: string;
              region: string;
              name_ar: string;
              name_en: string;
            }[]}
            labels={{
              what: t.reqWhat,
              whatPlaceholder: t.reqWhatPlaceholder,
              where: t.reqWhere,
              address: t.reqAddress,
              when: t.reqWhen,
              whenOptions: t.reqWhenOptions as unknown as Record<string, string>,
              name: t.reqName,
              phone: t.reqPhone,
              submit: t.reqSubmit,
              sending: t.reqSending,
              sentTitle: t.reqSentTitle,
              sentBody: t.reqSentBody,
              backToProfile: t.reqBack,
              error: dict.auth.errorGeneric,
              regions: t.regionNames as unknown as Record<string, string>,
            }}
          />
        </div>
      </Container>
    </div>
  );
}
