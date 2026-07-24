import { MapPin, Phone } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";

type BranchView = {
  id: string;
  name: string | null;
  address: string | null;
  area: string | null;
  phone: string | null;
};

export function StoreBranches({
  branches,
  dict,
}: {
  branches: BranchView[];
  dict: Dictionary;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-bold">{dict.os.branchesPublic.title}</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {branches.map((b) => (
          <li
            key={b.id}
            className="flex items-start gap-2.5 rounded-xl border border-border px-3.5 py-2.5 text-sm"
          >
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="font-semibold">{b.name || b.area}</p>
              {b.address && (
                <p className="mt-0.5 text-muted-foreground">{b.address}</p>
              )}
              {b.phone && (
                <a
                  href={`tel:${b.phone}`}
                  className="mt-0.5 inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span dir="ltr">{b.phone}</span>
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
