import Image from "next/image";
import {
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  Star,
  BadgeCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { StoreView } from "@/lib/data/store-view";
import { SITE_URL } from "@/lib/site";
import { parseHours, isOpenNow, daySpan } from "@/lib/hours";
import { FollowButton } from "@/components/follow-button";
import { ShareButton } from "@/components/share-button";
import { MessageStoreButton } from "@/components/message-store-button";
import { ProBadge } from "@/components/pro-badge";

export function StoreHeader({
  store,
  id,
  Icon,
  style,
  dict,
  lang,
  hasVerified,
  headerRating,
  headerCount,
  ordersFulfilled,
  isFollowing,
}: {
  store: StoreView;
  id: string;
  Icon: LucideIcon;
  style: { cover: string; iconWrap: string };
  dict: Dictionary;
  lang: Locale;
  hasVerified: boolean;
  headerRating: number | null;
  headerCount: number;
  ordersFulfilled: number;
  isFollowing: boolean;
}) {
  const cat = dict.catalog[store.category];
  return (
    <div className="relative z-10 -mt-6 rounded-2xl border border-border bg-surface p-5 shadow-md sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface shadow-md ring-4 ring-surface">
            {store.logoUrl ? (
              <Image src={store.logoUrl} alt={store.name} width={64} height={64} className="h-full w-full object-cover" sizes="64px" />
            ) : (
              <span
                className={`flex h-full w-full items-center justify-center rounded-2xl ${style.iconWrap}`}
              >
                <Icon className="h-7 w-7" />
              </span>
            )}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {store.name}
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${store.isOpen ? "bg-emerald-600" : "bg-slate-500"}`}
              >
                {store.isOpen ? dict.store.openNow : dict.store.closed}
              </span>
              {store.plan === "pro" && <ProBadge />}
              {store.registered && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {dict.featured.registered}
                </span>
              )}
              {hasVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {dict.verifications.verifiedBadge}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-muted-foreground">{cat.name}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {headerRating != null && (
                <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-bold">{headerRating.toFixed(1)}</span>
                  <span className="text-muted-foreground">
                    ({headerCount} {dict.featured.reviews})
                  </span>
                </span>
              )}
              {ordersFulfilled > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 font-semibold text-success">
                  <BadgeCheck className="h-4 w-4" />
                  {dict.store.ordersFulfilled.replace(
                    "{n}",
                    String(ordersFulfilled),
                  )}
                </span>
              )}
              {store.prepTime && store.acceptsDelivery && (
                <span className="flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {dict.store.deliveryIn.replace("{t}", store.prepTime)}
                </span>
              )}
              {store.area && (
                <span className="flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {store.area}
                </span>
              )}
              {(() => {
                // Structured hours win: live open/closed + today's span.
                const wh = parseHours(store.hours);
                // Server render reads the clock once per request.
                const now = new Date();
                const open = isOpenNow(wh, now);
                const span = daySpan(wh, now);
                if (open != null) {
                  return (
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          open
                            ? "bg-success-soft text-success"
                            : "bg-danger-soft text-danger"
                        }`}
                      >
                        {open
                          ? dict.os.hours.openNow
                          : dict.os.hours.closedNow}
                      </span>
                      {span && (
                        <span
                          className="text-muted-foreground"
                          dir="ltr"
                        >
                          {span.open}–{span.close}
                        </span>
                      )}
                    </span>
                  );
                }
                return store.openingHours ? (
                  <span className="flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {store.openingHours}
                  </span>
                ) : null;
              })()}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {store.isReal && (
            <FollowButton
              storeId={id}
              following={isFollowing}
              lang={lang}
              dict={dict}
            />
          )}
          <ShareButton
            title={store.name}
            dict={dict}
            url={
              store.slug
                ? `${SITE_URL}/${lang}/${store.slug}`
                : `${SITE_URL}/${lang}/store/${id}`
            }
          />
          {store.isReal && (
            <MessageStoreButton storeId={id} lang={lang} dict={dict} />
          )}
          {store.phone && (
            <a
              href={`tel:${store.phone}`}
              className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-muted"
            >
              <Phone className="h-4 w-4" />
              {dict.store.call}
            </a>
          )}
          {store.whatsapp && (
            <a
              href={`https://wa.me/${store.whatsapp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              <MessageCircle className="h-4 w-4" />
              {dict.store.whatsapp}
            </a>
          )}
          {store.instagram && (
            <a href={store.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-muted">
              {dict.merchant.instagram}
            </a>
          )}
          {store.facebook && (
            <a href={store.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-muted">
              {dict.merchant.facebook}
            </a>
          )}
          {store.website && (
            <a href={store.website} target="_blank" rel="noopener noreferrer" className="flex items-center rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-muted">
              {dict.merchant.website}
            </a>
          )}
        </div>
      </div>

      {store.description && (
        <p className="mt-4 border-t border-border pt-4 text-muted-foreground">
          {store.description}
        </p>
      )}
    </div>
  );
}
