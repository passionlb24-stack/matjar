import { notFound } from "next/navigation";
import { ScrollText } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

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
        <PageHeader icon={ScrollText} title={t.title} subtitle={t.subtitle} />

        {rows.length === 0 ? (
          <EmptyState icon={ScrollText} title={t.empty} />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-start text-sm">
                <thead className="bg-surface-muted/60 text-xs font-bold text-muted-foreground">
                  <tr>
                    <th className="p-3.5 text-start">{t.actor}</th>
                    <th className="p-3.5 text-start">{t.action}</th>
                    <th className="p-3.5 text-start">{t.entity}</th>
                    <th className="p-3.5 text-start">{t.when}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-border transition-colors hover:bg-surface-muted"
                    >
                      <td className="p-3.5 font-semibold">
                        {r.profiles?.full_name ?? "—"}
                      </td>
                      <td className="p-3.5">
                        <Badge variant="neutral" size="sm">
                          {r.action}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-muted-foreground">
                        {[r.entity_type, r.entity_id?.slice(0, 8)]
                          .filter(Boolean)
                          .join(" · ")}
                      </td>
                      <td className="p-3.5 text-muted-foreground tabular-nums">
                        {fmt(r.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Container>
    </div>
  );
}
