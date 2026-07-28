import { BookOpen } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { JoinAction } from "@/components/join-action";

export type CourseRow = {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  price: number | null;
  duration: string | null;
  schedule: string | null;
  level: string | null;
};

// Public courses list (education sector). No payment gateway, so "enroll" opens
// a pre-filled WhatsApp message to the business — a lead, not a charge.
export function StoreCourses({
  courses,
  dict,
  lang,
  whatsapp,
}: {
  courses: CourseRow[];
  dict: Dictionary;
  lang: Locale;
  whatsapp: string | null;
}) {
  if (!courses.length) return null;
  const t = dict.courses;

  return (
    <section className="mt-10">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
        <BookOpen className="h-5 w-5 text-primary" />
        {t.publicTitle}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => {
          const name = lang === "en" ? c.name_en || c.name : c.name;
          const meta = [c.duration, c.schedule, c.level].filter(Boolean).join(" · ");
          return (
            <div
              key={c.id}
              className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-xs"
            >
              <h3 className="font-extrabold">{name}</h3>
              {c.price != null && (
                <p className="mt-1 text-2xl font-extrabold text-primary">${c.price}</p>
              )}
              {meta && (
                <p className="mt-1.5 text-sm font-semibold text-muted-foreground">{meta}</p>
              )}
              {c.description && (
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{c.description}</p>
              )}
              <JoinAction
                kind="course"
                targetId={c.id}
                whatsapp={whatsapp}
                waText={`${t.enrollMsg} ${name}`}
                loginHref={`/${lang}/login`}
                labels={{
                  join: t.enroll,
                  done: t.enrolled,
                  errorGeneric: dict.common.actionFailed,
                }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
