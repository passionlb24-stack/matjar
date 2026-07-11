import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Flame, ImageIcon } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getBestSellers } from "@/lib/data/best-sellers";
import { getUsdLbpRate } from "@/lib/data/settings";
import { formatLbp } from "@/lib/currency";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";

function formatPrice(price: number) {
  return price >= 1000 ? `$${Number(price).toLocaleString("en-US")}` : `$${price}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.bestSellers.title,
    description: dict.bestSellers.subtitle,
    openGraph: { title: dict.bestSellers.title, description: dict.bestSellers.subtitle },
  };
}

export default async function BestSellersPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const products = await getBestSellers();
  const lbpRate = await getUsdLbpRate();
  const l = lang as Locale;

  return (
    <div className="py-10">
      <Container>
        <div className="flex items-center gap-2">
          <Flame className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {dict.bestSellers.title}
          </h1>
        </div>
        <p className="mt-2 text-muted-foreground">{dict.bestSellers.subtitle}</p>

        {products.length ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p, i) => (
              <Link
                key={p.id}
                href={`/${lang}/product/${p.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative">
                  {p.imageUrl ? (
                    <Image
                      src={p.imageUrl}
                      alt={p.name}
                      width={300}
                      height={200}
                      className="h-36 w-full object-cover"
                      sizes="(max-width: 640px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="flex h-36 w-full items-center justify-center bg-surface-muted">
                      <ImageIcon className="h-10 w-10 text-black/10" />
                    </div>
                  )}
                  <span className="absolute start-2 top-2 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                    #{i + 1}
                  </span>
                  <span className="absolute end-2 top-2 rounded-full bg-surface/90 px-2 py-0.5 text-xs font-bold backdrop-blur">
                    {p.sold} {dict.bestSellers.sold}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <h3 className="line-clamp-2 font-bold leading-tight group-hover:text-primary">
                    {p.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.storeName}</p>
                  <p className="mt-2">
                    <span className="font-bold text-primary">
                      {formatPrice(p.discountPrice ?? p.price)}
                    </span>{" "}
                    {p.discountPrice != null && (
                      <span className="text-xs text-muted-foreground line-through">
                        {formatPrice(p.price)}
                      </span>
                    )}
                  </p>
                  {lbpRate > 0 && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatLbp(p.discountPrice ?? p.price, lbpRate, l)}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-10"
            icon={Flame}
            title={dict.bestSellers.empty}
            action={{ href: `/${lang}/explore`, label: dict.common.explore }}
          />
        )}
      </Container>
    </div>
  );
}
