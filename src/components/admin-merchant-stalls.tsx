import Link from "next/link";
import { MapPinOff, MessageCircle, PackageOpen } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { MerchantStalls, StallStage } from "@/lib/data/merchant-stalls";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Who is stuck, at what stage, for how long — and one tap to reach them.
//
// The attention queue above this answers "what is waiting on me": approvals,
// unanswered orders, open reports. By construction it cannot see a merchant who
// has done nothing at all, because doing nothing generates no event. That is
// most of the platform. Counted on 2026-08-21, of 15 active stores 4 have no
// catalogue at all and 11 have never had a customer, and the owner learned that
// by running a query, not by opening this page.
//
// Three rules the layout follows:
//
//   The stage is the headline, not a score. Each row says which of the three
//   walls this shop hit, because the sentence the owner should send differs
//   completely between them — and the prefilled message differs with it.
//
//   The clock is shown, not implied. "Stuck" and "stuck since June" are
//   different facts and only the second one is actionable.
//
//   One tap, and it opens WhatsApp with text he can still edit. Nothing here
//   sends, nothing writes, and there is no select-all: fifteen shopkeepers need
//   fifteen different sentences, which is precisely what a broadcast destroys.

/** Left to right, how far along the ladder the shop got. Deliberately NOT the
 *  order of the list: the list is ordered by what is worth an afternoon, and
 *  colouring by priority as well would say the same thing twice and hide the
 *  one thing the badge is for — which wall this particular shop hit. */
const STAGE_TONE: Record<StallStage, "danger" | "warning" | "info"> = {
  empty: "danger",
  thin: "warning",
  quiet: "info",
};

export function AdminMerchantStalls({
  data,
  dict,
}: {
  data: MerchantStalls | null;
  dict: Dictionary;
}) {
  // `null` means the reader is not a super admin, and the demand tables would
  // have come back empty for them under RLS — see getMerchantStalls. Nothing at
  // all beats a confidently wrong list of merchants to phone.
  if (!data || data.rows.length === 0) return null;
  const t = dict.admin.stalls;

  const stageLabel: Record<StallStage, string> = {
    empty: t.stageEmpty,
    thin: t.stageThin,
    quiet: t.stageQuiet,
  };
  const stageWhy: Record<StallStage, string> = {
    empty: t.whyEmpty,
    thin: t.whyThin,
    quiet: t.whyQuiet,
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-extrabold tracking-tight">{t.title}</h2>
        {/* Counts are rendered as their own LTR runs rather than interpolated
            into an Arabic sentence: "6/15" dropped inside RTL text renders with
            its parts in the wrong order, and the slash lands on the wrong side
            of the pair. */}
        <span className="text-xs font-semibold text-muted-foreground">
          <span dir="ltr" className="tabular-nums">
            {data.rows.length}/{data.activeStores}
          </span>{" "}
          {t.summaryStalled}
          {" · "}
          <span dir="ltr" className="tabular-nums">
            {data.working}
          </span>{" "}
          {t.summaryWorking}
        </span>
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">{t.subtitle}</p>

      <ul className="space-y-2.5">
        {data.rows.map((row) => (
          <Card as="li" key={row.id}>
            <CardBody className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-bold">{row.name}</h3>
                  <Badge variant={STAGE_TONE[row.stage]} size="sm">
                    {stageLabel[row.stage]}
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground">
                  {stageWhy[row.stage]}
                </p>

                {/* Every number on this screen lives in its own chip with an
                    explicit dir="ltr", rather than interpolated into an Arabic
                    sentence: a bare digit inside RTL text reorders around the
                    words next to it, and "3/3" in particular renders as "3/3"
                    pointing the wrong way. tabular-nums so the column of days
                    stays a column. */}
                <ul className="flex flex-wrap items-center gap-2 text-xs">
                  <li className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
                    <PackageOpen
                      className="h-3.5 w-3.5 text-muted-foreground"
                      aria-hidden
                    />
                    <span dir="ltr" className="font-bold tabular-nums">
                      {row.offerings}/{row.target}
                    </span>
                    <span className="text-muted-foreground">
                      {t.itemsLabel}
                    </span>
                  </li>
                  <li className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
                    <span dir="ltr" className="font-bold tabular-nums">
                      {row.days}
                    </span>
                    <span className="text-muted-foreground">
                      {t.daysLabel}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      {t.sinceLabel}
                    </span>
                    <time
                      dateTime={row.since}
                      dir="ltr"
                      className="tabular-nums text-muted-foreground"
                    >
                      {row.since}
                    </time>
                  </li>
                  {row.needsPin && (
                    <li className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-muted-foreground">
                      <MapPinOff className="h-3.5 w-3.5" aria-hidden />
                      {t.noPin}
                    </li>
                  )}
                </ul>
              </div>

              {/* 36px controls with a 6px transparent overhang each side — 48px
                  of hit area, and the 12px flex gap absorbs the two overhangs
                  exactly so adjacent targets never overlap. Same pattern and
                  the same arithmetic as crm-manager.tsx. */}
              <div className="flex shrink-0 items-center gap-3">
                {row.waHref ? (
                  <a
                    href={row.waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative flex h-9 items-center gap-1.5 rounded-xl bg-whatsapp px-3.5 text-xs font-bold text-whatsapp-foreground transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-whatsapp-hover"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    {t.message}
                  </a>
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t.noPhone}
                  </span>
                )}
                {/* The public page, not the admin row: the whole finding is
                    that a customer opening these stores finds nothing, and the
                    owner should be able to see that for himself in one tap. */}
                <Link
                  href={row.storePath}
                  target="_blank"
                  className="relative flex h-9 items-center rounded-xl border border-border px-3.5 text-xs font-bold transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:border-primary hover:text-primary"
                >
                  {t.openStore}
                </Link>
              </div>
            </CardBody>
          </Card>
        ))}
      </ul>

      {/* Why the list is shorter than the platform. Without this line an owner
          who knows four of his shops are empty and sees one of them here reads
          the screen as broken rather than as filtered. */}
      {data.inGrace > 0 && (
        <p className="text-xs text-muted-foreground">
          <span dir="ltr" className="tabular-nums">
            {data.inGrace}
          </span>{" "}
          {t.graceNote}
        </p>
      )}
    </section>
  );
}
