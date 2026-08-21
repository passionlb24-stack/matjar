import Image from "next/image";
import { notFound } from "next/navigation";
import { Crown } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { requireAdminSection } from "@/lib/admin-guard";
import { filterByQuery } from "@/lib/admin-search";
import { FETCH_BOUNDS, fetchAllPages } from "@/lib/data/bounds";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminLeaderActions } from "@/components/admin-leader-actions";
import { AdminSearchBox } from "@/components/admin-search-box";
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
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireAdminSection("leaders", lang);
  const dict = await getDictionary(lang);
  const t = dict.admin.leaders;
  const ts = dict.admin.listSearch;
  const q = (await searchParams).q ?? "";

  const supabase = await createClient();
  // Same missing ceiling as the store roster (ISS-013): no `.limit()` here read
  // as "every leader" and meant "the first 1000". Three sort keys and none of
  // them unique, so `id` closes the order before `.range()` pages over it.
  const all = await fetchAllPages<LeaderRow>(
    (from, to) =>
      supabase
        .from("business_leaders")
        .select(
          "id, slug, name, name_en, headline, photo_url, published, sector, featured, verification_status, created_at",
        )
        .order("published", { ascending: true })
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: LeaderRow[] | null }>,
    FETCH_BOUNDS.adminLeaders,
    "business_leaders (admin)",
  );

  // The header counts the roster, not the search. "12 profiles · 3 awaiting
  // review" is a fact about the platform; recomputing it from the filtered set
  // would make the backlog appear to shrink as you type.
  const draftCount = all.filter((r) => !r.published).length;

  const rows = filterByQuery(all, q, (r) => [
    r.name,
    r.name_en,
    r.headline,
    r.sector,
    r.slug,
  ]);

  return (
    <div className="py-10">
      <Container>
        <PageHeader
          icon={Crown}
          title={t.title}
          subtitle={t.subtitle
            .replace("{total}", String(all.length))
            .replace("{drafts}", String(draftCount))}
        />

        {/* The roster is read whole, so there is no window to disclose — the
            hint only reports how much of it the query kept. */}
        <AdminSearchBox
          placeholder={t.searchPlaceholder}
          clearLabel={ts.clear}
          hint={q ? ts.matchCount.replace("{n}", String(rows.length)) : undefined}
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={Crown}
            title={q ? ts.noMatch.replace("{q}", q) : t.empty}
          />
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
                      <Image
                        src={r.photo_url}
                        alt={r.name}
                        width={48}
                        height={48}
                        sizes="48px"
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
                            {t.badgePublished}
                          </Badge>
                        ) : (
                          <Badge variant="warning" size="sm">
                            {t.badgeDraft}
                          </Badge>
                        )}
                        {r.featured && (
                          <Badge variant="primary" size="sm">
                            {t.badgeFeatured}
                          </Badge>
                        )}
                        {r.verification_status === "partially_verified" && (
                          <Badge variant="neutral" size="sm">
                            {t.badgePartial}
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
                    labels={{
                      feature: t.feature,
                      unfeature: t.unfeature,
                      verify: t.verify,
                      unverify: t.unverify,
                      hide: t.hide,
                      publish: t.publish,
                      delete: t.delete,
                      confirmDelete: t.confirmDelete,
                      confirm: dict.common.confirm,
                      cancel: dict.common.cancel,
                      error: dict.auth.errorGeneric,
                    }}
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
