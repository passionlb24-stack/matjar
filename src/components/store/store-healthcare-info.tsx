import type { Dictionary } from "@/i18n/get-dictionary";
import type { StoreView } from "@/lib/data/store-view";

export function StoreHealthcareInfo({
  store,
  dict,
}: {
  store: StoreView;
  dict: Dictionary;
}) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {store.specialties && (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="text-sm font-bold text-muted-foreground">
            {dict.store.specialtiesTitle}
          </h3>
          <p className="mt-1 font-medium">{store.specialties}</p>
        </div>
      )}
      {store.insurance && (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="text-sm font-bold text-muted-foreground">
            {dict.store.insuranceTitle}
          </h3>
          <p className="mt-1 font-medium">{store.insurance}</p>
        </div>
      )}
    </div>
  );
}
