import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Wrench } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { CraftReviewForm } from "@/components/crafts/craft-review-form";
import { CardListUl } from "@/components/ui/card";

type RequestRow = {
  id: string;
  provider_id: string;
  description: string;
  status: string;
  created_at: string;
  craft_providers: { id: string; name: string; headline: string | null } | null;
  craft_reviews: { id: string }[];
};

const TONE: Record<string, string> = {
  pending: "bg-warning-soft text-warning",
  accepted: "bg-primary-soft text-primary",
  in_progress: "bg-primary-soft text-primary",
  completed: "bg-success-soft text-success",
  declined: "bg-surface-muted text-muted-foreground",
  cancelled: "bg-surface-muted text-muted-foreground",
};

// The customer's side of a service request.
//
// Exists mainly so a finished job has somewhere to be rated from. The review
// form appears on a request the moment the tradesman marks it done — which is
// when the customer has an opinion, and the last moment they are still thinking
// about it. Asking a week later gets nothing.
export default async function MyCraftRequestsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.crafts;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login?next=/${lang}/crafts/requests`);

  const { data } = await supabase
    .from("craft_requests")
    .select(
      `id, provider_id, description, status, created_at,
       craft_providers(id, name, headline),
       craft_reviews(id)`,
    )
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as RequestRow[];
  const statuses = t.reqStatuses as unknown as Record<string, string>;

  return (
    <div className="py-8 sm:py-10">
      <Container className="max-w-2xl">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t.myRequests}
        </h1>

        {rows.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={Wrench}
              title={t.myRequestsEmpty}
              description={t.myRequestsEmptyBody}
              action={{ href: `/${lang}/crafts`, label: t.title }}
            />
          </div>
        ) : (
          <CardListUl className="mt-6">
            {rows.map((r) => {
              const provider = r.craft_providers;
              const reviewed = (r.craft_reviews ?? []).length > 0;
              return (
                <li key={r.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {provider ? (
                      <Link
                        href={`/${lang}/crafts/p/${provider.id}`}
                        className="font-bold hover:text-primary"
                      >
                        {provider.name}
                        {provider.headline && (
                          <span className="ms-2 text-sm font-normal text-muted-foreground">
                            {provider.headline}
                          </span>
                        )}
                      </Link>
                    ) : (
                      <span className="font-bold">—</span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        TONE[r.status] ?? "bg-surface-muted text-muted-foreground"
                      }`}
                    >
                      {statuses[r.status] ?? r.status}
                    </span>
                  </div>

                  <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                    {r.description}
                  </p>

                  {/* Only a completed job, and only once — both also enforced
                      by the insert policy, so this is the invitation rather
                      than the gate. */}
                  {r.status === "completed" && !reviewed && provider && (
                    <div className="mt-3">
                      <CraftReviewForm
                        providerId={provider.id}
                        requestId={r.id}
                        customerId={user.id}
                        labels={{
                          title: t.rateTitle,
                          comment: t.rateComment,
                          commentPlaceholder: t.rateCommentPlaceholder,
                          submit: t.rateSubmit,
                          sending: t.rateSending,
                          thanks: t.rateThanks,
                          needRating: t.rateNeedStars,
                          error: dict.auth.errorGeneric,
                        }}
                      />
                    </div>
                  )}

                  {reviewed && (
                    <p className="mt-3 text-sm font-semibold text-success">
                      {t.rateDone}
                    </p>
                  )}
                </li>
              );
            })}
          </CardListUl>
        )}
      </Container>
    </div>
  );
}
