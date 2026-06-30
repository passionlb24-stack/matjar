import { Wallet, BadgeCheck, MapPin, MessageCircle } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

// Static trust signals — value props that reassure buyers regardless of how
// many stores exist yet (so it never looks empty early on).
export function TrustStrip({ dict }: { dict: Dictionary }) {
  const items = [
    { Icon: Wallet, title: dict.trust.cod, desc: dict.trust.codDesc },
    { Icon: BadgeCheck, title: dict.trust.verified, desc: dict.trust.verifiedDesc },
    { Icon: MapPin, title: dict.trust.lebanon, desc: dict.trust.lebanonDesc },
    { Icon: MessageCircle, title: dict.trust.direct, desc: dict.trust.directDesc },
  ];

  return (
    <section className="border-y border-border bg-surface-muted/30 py-6">
      <Container>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {items.map(({ Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight">{title}</p>
                <p className="truncate text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
