"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Zap, ImageIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatUsd, formatLbp } from "@/lib/currency";
import { Container } from "@/components/ui/container";

type Deal = {
  id: string;
  name: string;
  price: number;
  discountPrice: number | null;
  imageUrl: string | null;
  storeName: string;
  off: number;
};

function useCountdownToMidnight() {
  const [left, setLeft] = useState<{ h: string; m: string; s: string } | null>(
    null,
  );
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(24, 0, 0, 0);
      const ms = end.getTime() - now.getTime();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      setLeft({ h: pad(h), m: pad(m), s: pad(s) });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return left;
}

export function DealOfTheDay({
  deal,
  lang,
  dict,
  lbpRate,
}: {
  deal: Deal;
  lang: Locale;
  dict: Dictionary;
  lbpRate: number;
}) {
  const t = dict.deal;
  const left = useCountdownToMidnight();
  const shown = deal.discountPrice ?? deal.price;

  return (
    <section className="py-8">
      <Container>
        <Link
          href={`/${lang}/product/${deal.id}`}
          className="group grid overflow-hidden rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary-soft to-surface shadow-sm transition-shadow hover:shadow-md sm:grid-cols-2"
        >
          <div className="relative min-h-56 bg-surface-muted">
            {deal.imageUrl ? (
              <Image
                src={deal.imageUrl}
                alt={deal.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 50vw"
              />
            ) : (
              <div className="flex h-full min-h-56 items-center justify-center">
                <ImageIcon className="h-16 w-16 text-black/10" />
              </div>
            )}
            {deal.off > 0 && (
              <span className="absolute start-4 top-4 rounded-full bg-red-600 px-3 py-1 text-sm font-extrabold text-white shadow">
                -{deal.off}%
              </span>
            )}
          </div>

          <div className="flex flex-col justify-center gap-3 p-6 sm:p-8">
            <span className="flex items-center gap-1.5 text-sm font-extrabold text-primary">
              <Zap className="h-4 w-4 fill-primary" />
              {t.title}
            </span>
            <h2 className="text-2xl font-extrabold leading-tight group-hover:text-primary sm:text-3xl">
              {deal.name}
            </h2>
            <p className="text-sm text-muted-foreground">{deal.storeName}</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-extrabold text-primary">
                {formatUsd(shown)}
              </span>
              {deal.discountPrice != null && (
                <span className="pb-1 text-lg text-muted-foreground line-through">
                  {formatUsd(deal.price)}
                </span>
              )}
            </div>
            {lbpRate > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatLbp(shown, lbpRate, lang)}
              </p>
            )}

            {/* Countdown */}
            <div className="mt-1">
              <p className="text-xs font-semibold text-muted-foreground">
                {t.endsIn}
              </p>
              <div className="mt-1 flex gap-2 font-mono text-lg font-extrabold tabular-nums">
                {left ? (
                  <>
                    <span className="rounded-lg bg-foreground px-2.5 py-1 text-background">
                      {left.h}
                    </span>
                    <span className="text-muted-foreground">:</span>
                    <span className="rounded-lg bg-foreground px-2.5 py-1 text-background">
                      {left.m}
                    </span>
                    <span className="text-muted-foreground">:</span>
                    <span className="rounded-lg bg-foreground px-2.5 py-1 text-background">
                      {left.s}
                    </span>
                  </>
                ) : (
                  <span className="h-8" />
                )}
              </div>
            </div>

            <span className="mt-2 inline-block rounded-xl bg-primary px-6 py-3 text-center text-sm font-bold text-primary-foreground transition-colors group-hover:bg-primary-hover">
              {t.cta}
            </span>
          </div>
        </Link>
      </Container>
    </section>
  );
}
