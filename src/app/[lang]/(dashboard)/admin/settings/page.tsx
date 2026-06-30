import { notFound } from "next/navigation";
import { Settings } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { AdminSettingsForm } from "@/components/admin-settings-form";

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  // Role is enforced by the admin layout.
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "usd_lbp_rate")
    .maybeSingle();
  const rate = (data as { value?: string } | null)?.value ?? "0";

  return (
    <div className="py-10">
      <Container>
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-extrabold tracking-tight">
            {dict.admin.platform.title}
          </h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          {dict.admin.platform.subtitle}
        </p>
        <div className="mt-6">
          <AdminSettingsForm dict={dict} initialRate={rate} />
        </div>
      </Container>
    </div>
  );
}
