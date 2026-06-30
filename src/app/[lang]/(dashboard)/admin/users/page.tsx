import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { AdminUsersClient, type AdminUser } from "@/components/admin-users-client";

export default async function AdminUsersPage({
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

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, is_active, created_at")
    .order("created_at", { ascending: false });
  const users = (data ?? []) as AdminUser[];

  return (
    <AdminUsersClient
      lang={lang}
      dict={dict}
      users={users}
      currentUserId={user?.id ?? ""}
    />
  );
}
