import { notFound } from "next/navigation";
import { ScrollText } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { requireAdminSection } from "@/lib/admin-guard";
import { filterByQuery } from "@/lib/admin-search";
import { warnIfTruncated } from "@/lib/data/bounds";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminSearchBox } from "@/components/admin-search-box";

/** How far back this page reads. A log is the one list where "most recent N"
 *  is a legitimate answer rather than a truncation — but only if the page says
 *  so, which is why the number is named here and printed under the search box
 *  instead of living anonymously inside `.limit()`. */
const WINDOW = 300;

export default async function AdminAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireAdminSection("audit", lang);
  const dict = await getDictionary(lang);
  const q = (await searchParams).q ?? "";

  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, created_at, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(WINDOW);

  const all = (data ?? []) as unknown as {
    id: string;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    created_at: string;
    profiles: { full_name: string | null } | null;
  }[];
  warnIfTruncated(all, WINDOW, "audit_logs (admin)");

  const t = dict.admin.audit;
  const ts = dict.admin.listSearch;
  const verbs = dict.admin.auditLabels.verbs as Record<string, string>;
  const entities = dict.admin.auditLabels.entities as Record<string, string>;

  // ISS-014. The haystack is what is on the screen, not what is in the column:
  // the table renders "حذف" for action `deleted`, so an admin who types "حذف"
  // must find it. Matching the raw enum only would mean the search worked in
  // English and quietly failed in the language the page is written in. The raw
  // value stays in the haystack too, for anyone who thinks in the database.
  const rows = filterByQuery(all, q, (r) => [
    r.profiles?.full_name,
    verbs[r.action] ?? r.action,
    r.action,
    r.entity_type ? (entities[r.entity_type] ?? r.entity_type) : null,
    r.entity_type,
    r.entity_id,
  ]);
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(lang === "ar" ? "ar" : "en", {
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <div className="py-10">
      <Container>
        <PageHeader icon={ScrollText} title={t.title} subtitle={t.subtitle} />

        <AdminSearchBox
          placeholder={t.searchPlaceholder}
          clearLabel={ts.clear}
          // Printed whether or not anything matched. "No results" and "no
          // results in the 300 entries this page holds" are different answers,
          // and the log is the surface where confusing them is worst — an admin
          // concluding an action was never taken because it scrolled off.
          hint={
            q
              ? `${ts.matchCount.replace("{n}", String(rows.length))} · ${ts.window.replace("{n}", String(all.length))}`
              : ts.window.replace("{n}", String(all.length))
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={q ? ts.noMatch.replace("{q}", q) : t.empty}
          />
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
                          {verbs[r.action] ?? r.action}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-muted-foreground">
                        {[
                          r.entity_type
                            ? (entities[r.entity_type] ?? r.entity_type)
                            : null,
                          r.entity_id?.slice(0, 8),
                        ]
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
