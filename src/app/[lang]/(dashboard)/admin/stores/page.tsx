import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { requireAdminSection } from "@/lib/admin-guard";
import {
  FETCH_BOUNDS,
  fetchAllByIds,
  fetchAllPages,
} from "@/lib/data/bounds";
import { AdminStoresClient, type AdminStore } from "@/components/admin-stores-client";

type StoreRow = {
  id: string;
  name: string;
  owner_id: string;
  region: string | null;
  status: "pending" | "active" | "suspended" | "rejected";
  plan: "free" | "basic" | "pro" | "business";
  is_verified: boolean;
  featured_until: string | null;
  commercial_reg_no: string | null;
  commercial_reg_verified: boolean;
  status_reason: string | null;
  status_changed_at: string | null;
  status_changed_by: string | null;
  business_types: { name_ar: string; name_en: string } | null;
};

export default async function AdminStoresPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireAdminSection("stores", lang);
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  // ISS-013. This select used to carry no `.limit()` and no `.range()`, which
  // reads as "all of them" and is not: PostgREST answers an unbounded select
  // with `db-max-rows` rows and calls it a success. At 1001 stores this page
  // would have shown 1000 and said nothing — on the screen whose entire job is
  // deciding which stores are live.
  //
  // Same shape as store-view.ts / market.ts rather than a second mechanism:
  // identical select, filter and order on every round trip, and `id` appended
  // to the order because `created_at` is not unique. Without that tiebreaker
  // `.range()` pages by position over an order the database may resolve either
  // way, so two stores created in the same second can land on both pages or on
  // neither — the failure mode that makes naive paging worse than no paging.
  const rows = await fetchAllPages<StoreRow>(
    (from, to) =>
      supabase
        .from("stores")
        .select(
          "id, name, owner_id, region, status, plan, is_verified, featured_until, commercial_reg_no, commercial_reg_verified, status_reason, status_changed_at, status_changed_by, business_types(name_ar, name_en)",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: StoreRow[] | null }>,
    FETCH_BOUNDS.adminStores,
    "stores (admin roster)",
  );

  // Resolve owner names in one round-trip. The admin who last set each status
  // rides along in the same lookup — "suspended by someone" is barely better
  // than "suspended", and a second query for a handful of ids is waste.
  const peopleIds = [
    ...new Set([
      ...rows.map((r) => r.owner_id),
      ...rows.map((r) => r.status_changed_by).filter((id): id is string => !!id),
    ]),
  ];
  const ownerMap = new Map<string, string>();
  if (peopleIds.length) {
    // The other half of ISS-013 on this page. `peopleIds` now scales with the
    // store count, and an `.in()` filter travels in the query string — a
    // thousand uuids is a ~40KB URL that a proxy rejects before the database
    // ever sees it. fetchAllByIds chunks the ids and pages each chunk, which is
    // what stores.ts already does for the follows lookup.
    type PersonRow = { id: string; full_name: string | null };
    const owners = await fetchAllByIds<PersonRow>(
      peopleIds,
      (chunk, from, to) =>
        supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", chunk)
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{
          data: PersonRow[] | null;
        }>,
      FETCH_BOUNDS.adminStorePeople,
      "profiles (admin store roster)",
    );
    for (const o of owners) {
      if (o.full_name) ownerMap.set(o.id, o.full_name);
    }
  }

  const stores: AdminStore[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    region: r.region,
    status: r.status,
    plan: r.plan,
    isVerified: r.is_verified,
    featuredUntil: r.featured_until,
    commercialRegNo: r.commercial_reg_no,
    commercialRegVerified: r.commercial_reg_verified,
    // NULL stays NULL all the way to the screen. Nothing here invents a reason
    // for the 20 stores suspended before there was anywhere to write one.
    statusReason: r.status_reason,
    statusChangedAt: r.status_changed_at,
    statusChangedByName: r.status_changed_by
      ? (ownerMap.get(r.status_changed_by) ?? null)
      : null,
    typeName: r.business_types
      ? lang === "ar"
        ? r.business_types.name_ar
        : r.business_types.name_en
      : null,
    ownerName: ownerMap.get(r.owner_id) ?? null,
  }));

  return <AdminStoresClient lang={lang} dict={dict} stores={stores} />;
}
