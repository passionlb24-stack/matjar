import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";

export default async function AdminAuditPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, created_at, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = (data ?? []) as unknown as {
    id: string;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    created_at: string;
    profiles: { full_name: string | null } | null;
  }[];

  const t = dict.admin.audit;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(lang === "ar" ? "ar" : "en", {
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <div className="py-10">
      <Container>
        <h1 className="text-3xl font-extrabold tracking-tight">{t.title}</h1>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>

        {rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
            {t.empty}
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[600px] text-start text-sm">
              <thead className="bg-surface-muted/60 text-xs font-bold text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">{t.actor}</th>
                  <th className="p-3 text-start">{t.action}</th>
                  <th className="p-3 text-start">{t.entity}</th>
                  <th className="p-3 text-start">{t.when}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3 font-semibold">
                      {r.profiles?.full_name ?? "—"}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-bold">
                        {r.action}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {[r.entity_type, r.entity_id?.slice(0, 8)]
                        .filter(Boolean)
                        .join(" · ")}
                    </td>
                    <td className="p-3 text-muted-foreground">{fmt(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>
    </div>
  );
}
