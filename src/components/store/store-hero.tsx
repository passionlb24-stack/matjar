import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { StoreView } from "@/lib/data/store-view";
import type { HeroVariant } from "@/lib/themes";
import { Container } from "@/components/ui/container";
import { BackButton } from "@/components/back-button";

// The hero's ANATOMY changes with the storefront theme (0168), not just its
// color: "cover" is the classic tall banner, "slim" is the minimal hairline
// header, "poster" is the bold color block with a heavy base rule, "band" is
// the luxe thin band with a centered diamond. A merchant-uploaded cover photo
// is always honored — the variant then only adjusts height and finish.
export function StoreHero({
  store,
  Icon,
  style,
  dict,
  lang,
  variant = "cover",
}: {
  store: StoreView;
  Icon: LucideIcon;
  style: { cover: string; iconWrap: string };
  dict: Dictionary;
  lang: Locale;
  variant?: HeroVariant;
}) {
  // Heights only apply when there is NO uploaded photo — they are decoration,
  // and each theme decorates differently.
  const heights: Record<HeroVariant, string> = {
    cover: "h-48 sm:h-60",
    slim: "h-16 sm:h-20",
    poster: "h-40 sm:h-52",
    band: "h-20 sm:h-24",
  };

  // A merchant's banner is 3:1 everywhere: here, on the card in search, and in
  // the upload box where they framed it. Before this, the same photo was a
  // 2:1 block on a phone, a 5:1 strip on a laptop, and a 13:1 sliver under the
  // luxe theme — so a banner that looked right in one place was beheaded in
  // another. The cap stops the banner eating a wide desktop screen; past
  // ~1080px it trims top and bottom, which is why the merchant is told to keep
  // the important part in the middle.
  const bannerHeight = "h-[33.333vw] max-h-[360px]";

  const back = (
    <Container className="pointer-events-none absolute inset-x-0 top-3 z-20">
      <BackButton
        label={dict.common.back}
        fallbackHref={`/${lang}/explore`}
        className={
          !store.coverUrl && (variant === "slim" || variant === "band")
            ? "pointer-events-auto rounded-full border border-border bg-surface/80 px-3 py-1.5 backdrop-blur-sm hover:bg-surface"
            : "pointer-events-auto rounded-full bg-black/40 px-3 py-1.5 !text-white backdrop-blur-sm hover:bg-black/55 hover:!text-white"
        }
      />
    </Container>
  );

  // Fallback surface when the merchant hasn't uploaded a cover photo.
  const fallback =
    variant === "slim" ? (
      <div className="h-full w-full border-b border-border bg-surface" />
    ) : variant === "poster" ? (
      <div className="flex h-full w-full items-end overflow-hidden bg-primary">
        <Icon className="mb-[-4%] ms-6 h-36 w-36 text-primary-foreground/10 sm:h-48 sm:w-48" />
      </div>
    ) : variant === "band" ? (
      <div className="flex h-full w-full items-center justify-center border-b border-border bg-gradient-to-b from-primary-soft/70 to-surface">
        <span className="text-[10px] tracking-[0.5em] text-primary">◆</span>
      </div>
    ) : (
      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${style.cover}`}>
        <Icon className="h-28 w-28 text-black/[0.06]" />
      </div>
    );

  return (
    <div
      className={`relative ${
        store.coverUrl ? bannerHeight : heights[variant]
      } ${variant === "poster" ? "border-b-4 border-foreground" : ""}`}
    >
      {store.coverUrl ? (
        <Image
          src={store.coverUrl}
          alt={store.name}
          fill
          // object-center is the default, but it is the whole contract here:
          // the middle of the photo is the part that survives every screen.
          className="object-cover object-center"
          sizes="100vw"
          priority
        />
      ) : (
        fallback
      )}
      {store.coverUrl && variant !== "slim" && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-transparent" />
      )}
      {back}
    </div>
  );
}
