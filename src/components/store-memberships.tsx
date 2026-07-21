import { Gem, MessageCircle } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export type MembershipPlan = {
  id: string;
  name: string;
  name_en: string | null;
  price: number | null;
  period: string;
  description: string | null;
};

// Public membership/subscription plans (gyms, clubs, schools). The platform has
// no payment gateway, so "join" opens a pre-filled WhatsApp message to the
// business — a contact/lead, not a charge.
export function StoreMemberships({
  plans,
  dict,
  lang,
  whatsapp,
}: {
  plans: MembershipPlan[];
  dict: Dictionary;
  lang: Locale;
  whatsapp: string | null;
}) {
  if (!plans.length) return null;
  const t = dict.memberships;
  const periods = t.periods as Record<string, string>;
  const wa = whatsapp ? whatsapp.replace(/[^0-9]/g, "") : null;

  return (
    <section className="mt-10">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
        <Gem className="h-5 w-5 text-primary" />
        {t.publicTitle}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => {
          const name = lang === "en" ? p.name_en || p.name : p.name;
          const href = wa
            ? `https://wa.me/${wa}?text=${encodeURIComponent(`${t.joinMsg} ${name}`)}`
            : null;
          return (
            <div
              key={p.id}
              className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-xs"
            >
              <h3 className="font-extrabold">{name}</h3>
              {p.price != null && (
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-primary">
                    ${p.price}
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">
                    · {periods[p.period] ?? p.period}
                  </span>
                </p>
              )}
              {p.description && (
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  {p.description}
                </p>
              )}
              {href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  <MessageCircle className="h-4 w-4" />
                  {t.join}
                </a>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
