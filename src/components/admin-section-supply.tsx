import { EyeOff } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { GatedSection } from "@/lib/data/section-supply";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Row = {
  section: GatedSection;
  count: number;
  linked: boolean;
  needs: number;
};

/**
 * Which verticals are currently hidden from the menu and the footer, and how
 * short each one is.
 *
 * This exists because the gate was invisible. Sections drop out of navigation
 * automatically when nothing is behind them, which is right — a link to an
 * empty page is a wasted tap. But the owner found out that "وظائف" had
 * disappeared by noticing a gap in his own site, with nothing anywhere saying a
 * section had been gated or why. An automatic rule nobody can observe is
 * indistinguishable from a bug, and the person who can actually fix the cause
 * (by recruiting a craftsman, or approving a listing) is the one person who was
 * not being told.
 *
 * Renders nothing when everything is linked — an admin panel that reports good
 * news every day trains people to stop reading it.
 */
export function AdminSectionSupply({
  rows,
  dict,
}: {
  rows: Row[];
  dict: Dictionary;
}) {
  const hidden = rows.filter((r) => !r.linked);
  if (hidden.length === 0) return null;

  // admin.nav.* already names all six for the sidebar. Reusing them rather
  // than adding a parallel set: the label an admin reads here and the one they
  // click in the nav should never be able to disagree.
  const label: Record<GatedSection, string> = {
    crafts: dict.admin.nav.crafts,
    jobs: dict.admin.nav.jobs,
    freelance: dict.admin.nav.freelance,
    wholesale: dict.admin.nav.wholesale,
    delivery: dict.admin.nav.delivery,
    market: dict.admin.nav.market,
  };

  return (
    <Card>
      <CardBody className="p-5">
        <div className="flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-bold">
            {dict.admin.sectionSupplyTitle}
          </h2>
          <Badge variant="warning" size="sm">
            {hidden.length}
          </Badge>
        </div>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
          {dict.admin.sectionSupplyBody}
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {hidden.map((r) => (
            <li
              key={r.section}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm"
            >
              <span className="font-semibold">{label[r.section]}</span>
              {/* The count is the whole point: "0" and "one short" are
                  different problems with different fixes, and the verdict
                  alone hid that distinction. LTR + tabular so the digit does
                  not reorder inside the Arabic label. */}
              <span
                dir="ltr"
                className="tabular-nums text-muted-foreground"
              >
                {r.count}
              </span>
              <span className="text-xs text-muted-foreground">
                {dict.admin.sectionSupplyNeeds}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
