import Image from "next/image";
import { Stethoscope } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";

export type DoctorView = {
  id: string;
  name: string;
  specialty: string | null;
  photo_url: string | null;
  bio: string | null;
};

export function StoreDoctors({
  doctors,
  dict,
}: {
  doctors: DoctorView[];
  dict: Dictionary;
}) {
  return (
    <>
      <h2 className="mb-4 mt-10 text-xl font-bold">
        {dict.store.doctorsTitle}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {doctors.map((d) => (
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
                <Stethoscope className="h-6 w-6" />
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
                <p className="mt-1 text-sm text-muted-foreground">
                  {d.bio}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
