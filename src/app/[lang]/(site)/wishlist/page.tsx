import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { Heart, ImageIcon } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";

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

  return (
    <div className="py-10">
      <Container>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {dict.wishlist.title}
        </h1>

        {products.length ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
                      alt=""
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
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Heart className="h-7 w-7" />
            </span>
            <p className="mt-4 text-muted-foreground">{dict.wishlist.empty}</p>
          </div>
        )}
      </Container>
    </div>
  );
}
