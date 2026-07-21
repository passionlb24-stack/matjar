import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { Container } from "@/components/ui/container";

// Shared chrome for a single Hub tool page: back link to the hub, title, and a
// short description, then the tool itself. Server component (no client cost).
export function HubToolShell({
  lang,
  hubLabel,
  title,
  desc,
  children,
}: {
  lang: Locale;
  hubLabel: string;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-10 sm:py-14">
      <Container className="max-w-4xl">
        <Link
          href={`/${lang}/hub`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {hubLabel}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{desc}</p>
        <div className="mt-8">{children}</div>
      </Container>
    </div>
  );
}
