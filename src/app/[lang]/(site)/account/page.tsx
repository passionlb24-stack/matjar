import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { ProfileForm } from "@/components/profile-form";

export default async function AccountPage({
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
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  const initial = {
    full_name:
      (profile?.full_name as string | null) ??
      (user.user_metadata?.full_name as string | undefined) ??
      "",
    phone: (profile?.phone as string | null) ?? "",
  };

  return (
    <div className="py-10">
      <Container className="max-w-xl">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {dict.account.title}
        </h1>
        <div className="mt-6">
          <ProfileForm dict={dict} initial={initial} />
        </div>
      </Container>
    </div>
  );
}
