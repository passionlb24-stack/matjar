import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createPublicClient } from "@/lib/supabase/public-client";
import { Container } from "@/components/ui/container";
import { ClockDevice } from "@/components/clock-device";

// The link on the sticker by the door: matjarlb.com/ar/clock/79a0a2fe
//
// Public on purpose. The employee has no Matjar account and never will, so a
// signed-in page was never going to work — that was the flaw that made the first
// version usable only on the owner's own tablet.
//
// Being public costs nothing here: the page shows the shop's name and no more.
// No roster, no employee ids. Identity comes from the phone's own credential and
// the punch is refused unless the phone is registered AND standing at the shop.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ClockPage({
  params,
}: {
  params: Promise<{ lang: string; code: string }>;
}) {
  const { lang, code } = await params;
  if (!isLocale(lang)) notFound();
  if (!/^[a-z0-9-]{4,32}$/i.test(code)) notFound();

  const supabase = createPublicClient();
  const { data } = await supabase.rpc("clock_store_context", {
    p_short_code: code,
  });
  const store = data as {
    store_id: string;
    name: string;
    has_location: boolean;
    radius: number;
  } | null;
  if (!store) notFound();

  const dict = await getDictionary(lang);
  const t = dict.os.clock as unknown as Record<string, string>;

  return (
    <div className="py-10">
      <Container>
        <ClockDevice
          shortCode={code}
          storeName={store.name}
          hasLocation={store.has_location}
          labels={{
            ...t,
            locationNote: t.locationNote.replace("{a}", String(store.radius)),
          }}
        />
      </Container>
    </div>
  );
}
