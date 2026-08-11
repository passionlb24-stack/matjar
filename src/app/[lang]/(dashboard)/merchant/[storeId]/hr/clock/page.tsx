import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { ClockKiosk, type RosterEntry } from "@/components/clock-kiosk";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The shared device screen, deliberately reachable by anyone signed in.
//
// The roster function returns names and nothing else — no rate, no papers, no
// PIN hash — and the punch itself is gated on the PIN, so leaving this page open
// on a tablet by the door is the intended way to use it rather than a leak. The
// owner's screen is /hr; this is the one the staff touch.
export default async function ClockKioskPage({
  params,
}: {
  params: Promise<{ lang: string; storeId: string }>;
}) {
  const { lang, storeId } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(storeId)) redirect(`/${lang}/merchant`);
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login?next=/${lang}/merchant/${storeId}/hr/clock`);

  const { data: roster } = await supabase.rpc("store_employee_roster", {
    p_store_id: storeId,
  });

  const t = dict.os.hr as unknown as Record<string, string>;

  return (
    <div className="py-10">
      <Container className="max-w-2xl">
        <Link
          href={`/${lang}/merchant/${storeId}/hr`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {t.title}
        </Link>
        <div className="mt-4">
          <ClockKiosk
            storeId={storeId}
            roster={(roster ?? []) as RosterEntry[]}
            labels={t}
          />
        </div>
      </Container>
    </div>
  );
}
