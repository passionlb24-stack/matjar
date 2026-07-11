import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import {
  StoreSettingsForm,
  type StoreSettings,
} from "@/components/store-settings-form";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StoreSettingsPage({
  params,
}: {
  params: Promise<{ lang: string; storeId: string }>;
}) {
  const { lang, storeId } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(storeId)) redirect(`/${lang}/merchant`);
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  // Owner-only.
  const { data: store } = await supabase
    .from("stores")
    .select("id, name, accepts_delivery, accepts_pickup, min_order, prep_time, payment_note, specialties, insurance, lat, lng, commercial_reg_no, commercial_reg_verified, business_types(slug)")
    .eq("id", storeId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) redirect(`/${lang}/merchant`);
  const isHealthcare =
    (store as unknown as { business_types: { slug: string } | null })
      .business_types?.slug === "healthcare";

  const initial: StoreSettings = {
    accepts_delivery: (store as { accepts_delivery: boolean }).accepts_delivery,
    accepts_pickup: (store as { accepts_pickup: boolean }).accepts_pickup,
    min_order:
      (store as { min_order: number | null }).min_order != null
        ? String((store as { min_order: number }).min_order)
        : "",
    prep_time: (store as { prep_time: string | null }).prep_time ?? "",
    payment_note: (store as { payment_note: string | null }).payment_note ?? "",
    specialties: (store as { specialties: string | null }).specialties ?? "",
    insurance: (store as { insurance: string | null }).insurance ?? "",
    lat:
      (store as { lat: number | null }).lat != null
        ? String((store as { lat: number }).lat)
        : "",
    lng:
      (store as { lng: number | null }).lng != null
        ? String((store as { lng: number }).lng)
        : "",
    commercial_reg_no:
      (store as { commercial_reg_no: string | null }).commercial_reg_no ?? "",
    commercial_reg_verified:
      (store as { commercial_reg_verified: boolean | null })
        .commercial_reg_verified ?? false,
  };

  return (
    <div className="py-10">
      <Container className="max-w-xl">
        <Link
          href={`/${lang}/merchant/${storeId}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {(store as { name: string }).name}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          {dict.merchant.settings.title}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {dict.merchant.settings.subtitle}
        </p>
        <div className="mt-6">
          <StoreSettingsForm
            storeId={storeId}
            dict={dict}
            initial={initial}
            isHealthcare={isHealthcare}
          />
        </div>
      </Container>
    </div>
  );
}
