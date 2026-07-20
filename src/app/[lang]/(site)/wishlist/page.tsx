import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { Bookmark, ImageIcon } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { getUsdLbpRate } from "@/lib/data/settings";
import { formatLbp } from "@/lib/currency";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

function formatPrice(price: number) {
  return price >= 1000 ? `$${Number(price).toLocaleString("en-US")}` : `$${price}`;
}

type WishRow = {
  products: {
    id: string;
    name: string;
    price: number;
    discount_price: number | null;
    image_url: string | null;
    status: string;
    stores: { name: string } | null;
  } | null;
};

export default async function WishlistPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data } = await supabase
    .from("wishlist")
    .select(
      "products(id, name, price, discount_price, image_url, status, stores(name))",
    )
    .eq("user_id", user.id);

  const products = ((data ?? []) as unknown as WishRow[])
    .map((w) => w.products)
    .filter((p): p is NonNullable<WishRow["products"]> => Boolean(p))
    .filter((p) => p.status === "active");
  const lbpRate = await getUsdLbpRate();
  const l = lang as Locale;

  return (
    <div className="py-10">
      <Container>
        <PageHeader title={dict.wishlist.title} icon={Bookmark} />

        {products.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => {
              const price = Number(p.price);
              const discount = p.discount_price != null ? Number(p.discount_price) : null;
              return (
                <Link
                  key={p.id}
                  href={`/${lang}/product/${p.id}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  {p.image_url ? (
                    <Image
                      src={p.image_url}
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
                  <div className="flex flex-1 flex-col p-3">
                    <h3 className="line-clamp-2 font-bold leading-tight group-hover:text-primary">
                      {p.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.stores?.name}
                    </p>
                    <p className="mt-2">
                      <span className="font-bold text-primary">
                        {formatPrice(discount ?? price)}
                      </span>{" "}
                      {discount != null && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatPrice(price)}
                        </span>
                      )}
                    </p>
                    {lbpRate > 0 && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatLbp(discount ?? price, lbpRate, l)}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Bookmark}
            title={dict.wishlist.empty}
            action={{ href: `/${lang}/explore`, label: dict.common.explore }}
          />
        )}
      </Container>
    </div>
  );
}
