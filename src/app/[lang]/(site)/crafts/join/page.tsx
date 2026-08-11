import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import {
  CraftJoinForm,
  type JoinArea,
  type JoinGroup,
  type JoinTrade,
} from "@/components/crafts/craft-join-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.crafts.joinTitle, description: dict.crafts.joinSubtitle };
}

// Registering as a tradesman.
//
// The whole reason the provider model was pulled out of `stores`: this page is
// the entire onboarding. No storefront, no plan, no catalogue — an account and
// the answers a customer needs.
export default async function CraftJoinPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.crafts;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Come back here after signing in, rather than dumping them on the homepage
  // having lost the intent that brought them.
  if (!user) redirect(`/${lang}/login?next=/${lang}/crafts/join`);

  // One provider profile per account. Someone who already has one is here by
  // accident — send them to it rather than letting them hit a unique violation.
  const { data: existing } = await supabase
    .from("craft_providers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) redirect(`/${lang}/crafts/me`);

  const [{ data: groups }, { data: trades }, { data: areas }] = await Promise.all([
    supabase
      .from("trade_groups")
      .select("slug, name_ar, name_en, icon")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("trades")
      .select("id, name_ar, name_en, icon, group_slug")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("lb_areas")
      .select("id, slug, region, name_ar, name_en")
      .order("sort_order"),
  ]);

  return (
    <div className="py-8 sm:py-10">
      <Container className="max-w-2xl">
        <Link
          href={`/${lang}/crafts`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {t.title}
        </Link>

        <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t.joinTitle}
        </h1>
        <p className="mt-2 text-muted-foreground">{t.joinSubtitle}</p>

        <div className="mt-6">
          <CraftJoinForm
            userId={user.id}
            lang={lang}
            dict={dict}
            groups={(groups ?? []) as JoinGroup[]}
            trades={(trades ?? []) as JoinTrade[]}
            areas={(areas ?? []) as JoinArea[]}
          />
        </div>
      </Container>
    </div>
  );
}
