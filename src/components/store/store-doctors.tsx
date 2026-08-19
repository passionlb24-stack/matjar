import Image from "next/image";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { CategoryKey } from "@/lib/catalog";
import { sectorTeamMeta } from "@/lib/sectors";

export type DoctorView = {
  id: string;
  name: string;
  specialty: string | null;
  photo_url: string | null;
  bio: string | null;
};

// The public roster. You choose a clinic (or a salon, or a tutoring centre) by
// the people in it, so this renders above the price list — but only when there
// are people to show. The empty case returns null rather than a heading over an
// empty grid: a clinic that has not added its doctors yet should look like a
// clinic without that section, not like a clinic with no doctors.
export function StoreDoctors({
  doctors,
  category,
  servicesByDoctor = {},
  dict,
}: {
  doctors: DoctorView[];
  /** The store's sector. The heading and the no-photo avatar come from it: a
   *  salon's roster read "الفريق" under a stethoscope for every business type
   *  that has one, because the module's storage key was doing duty as its
   *  label. */
  category: CategoryKey;
  /** doctor id → the names of the services that provider actually delivers
   *  (from service_providers). Absent/empty = no per-provider restriction was
   *  recorded, so nothing is claimed on that doctor's behalf. */
  servicesByDoctor?: Record<string, string[]>;
  dict: Dictionary;
}) {
  if (doctors.length === 0) return null;
  const team = sectorTeamMeta(category);
  const TeamIcon = team.Icon;
  return (
    <section>
      <h2 className="mb-4 mt-10 text-xl font-bold">
        {dict.os.team[team.labelKey]}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {doctors.map((d) => {
          const services = servicesByDoctor[d.id] ?? [];
          return (
            <div
              key={d.id}
              className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              {d.photo_url ? (
                <Image
                  src={d.photo_url}
                  alt=""
                  width={56}
                  height={56}
                  className="h-14 w-14 shrink-0 rounded-full object-cover"
                  sizes="56px"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
                  <TeamIcon className="h-6 w-6" />
                </span>
              )}
              <div className="min-w-0">
                <p className="font-bold">{d.name}</p>
                {d.specialty && (
                  <p className="text-sm font-semibold text-primary">
                    {d.specialty}
                  </p>
                )}
                {d.bio && (
                  <p className="mt-1 text-sm text-muted-foreground">{d.bio}</p>
                )}
                {services.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {services.map((s) => (
                      <li
                        key={s}
                        className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
