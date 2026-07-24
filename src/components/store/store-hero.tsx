import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { StoreView } from "@/lib/data/store-view";
import { Container } from "@/components/ui/container";
import { BackButton } from "@/components/back-button";

export function StoreHero({
  store,
  Icon,
  style,
  dict,
  lang,
}: {
  store: StoreView;
  Icon: LucideIcon;
  style: { cover: string; iconWrap: string };
  dict: Dictionary;
  lang: Locale;
}) {
  return (
    <div className="relative h-48 sm:h-60">
      {store.coverUrl ? (
        <Image src={store.coverUrl} alt={store.name} fill className="object-cover" sizes="100vw" priority />
      ) : (
        <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${style.cover}`}>
          <Icon className="h-28 w-28 text-black/[0.06]" />
        </div>
      )}
      {store.coverUrl && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-transparent" />
      )}
      <Container className="pointer-events-none absolute inset-x-0 top-3 z-20">
        <BackButton
          label={dict.common.back}
          fallbackHref={`/${lang}/explore`}
          className="pointer-events-auto rounded-full bg-black/40 px-3 py-1.5 !text-white backdrop-blur-sm hover:bg-black/55 hover:!text-white"
        />
      </Container>
    </div>
  );
}
