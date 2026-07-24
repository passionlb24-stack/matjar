import { notFound } from "next/navigation";
import { Crown } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { requireAdminSection } from "@/lib/admin-guard";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminLeaderActions } from "@/components/admin-leader-actions";
import { InitialsAvatar } from "@/components/hub/initials-avatar";

type LeaderRow = {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  headline: string | null;
  photo_url: string | null;
  published: boolean;
  sector: string | null;
  featured: boolean;
  verification_status: string | null;
  created_at: string;
};

// The admin gate (super_admin check) lives in admin/layout.tsx, so this page
// only needs the locale guard — same as the verifications admin page.
export default async function AdminLeadersPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireAdminSection("leaders", lang);

  const supabase = await createClient();
  const { data } = await supabase
    .from("business_leaders")
    .select(
      "id, slug, name, name_en, headline, photo_url, published, sector, featured, verification_status, created_at",
    )
    .order("published", { ascending: true })
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as LeaderRow[];

  const draftCount = rows.filter((r) => !r.published).length;

  return (
    <div className="py-10">
      <Container>
        <PageHeader
          icon={Crown}
          title="إدارة رجال الأعمال"
          subtitle={`راجِع الملفات المُرسَلة وانشرها أو أخفِها أو احذفها. ${rows.length} ملف · ${draftCount} بانتظار المراجعة.`}
        />

        {rows.length === 0 ? (
          <EmptyState icon={Crown} title="لا يوجد رجال أعمال بعد" />
        ) : (
          <Card data-animate>
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-muted"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {r.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.photo_url}
                        alt={r.name}
                        className="h-12 w-12 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <InitialsAvatar name={r.name} size="sm" />
                    )}

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{r.name}</span>
                        {r.published ? (
                          <Badge variant="success" size="sm">
                            منشور
                          </Badge>
                        ) : (
                          <Badge variant="warning" size="sm">
                            بانتظار المراجعة
                          </Badge>
                        )}
                        {r.featured && (
                          <Badge variant="primary" size="sm">
                            مميّز
                          </Badge>
                        )}
                        {r.verification_status === "partially_verified" && (
                          <Badge variant="neutral" size="sm">
                            تحقّق جزئي
                          </Badge>
                        )}
                      </div>
                      {r.headline && (
                        <p className="truncate text-sm text-muted-foreground">
                          {r.headline}
                        </p>
                      )}
                      {r.sector && (
                        <p className="truncate text-xs text-muted-foreground">
                          {r.sector}
                        </p>
                      )}
                    </div>
                  </div>

                  <AdminLeaderActions
                    id={r.id}
                    published={r.published}
                    featured={r.featured}
                    verificationStatus={r.verification_status}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}
      </Container>
    </div>
  );
}
