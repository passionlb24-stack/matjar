import { Truck } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";

function formatPrice(price: number) {
  return price >= 1000
    ? `$${Number(price).toLocaleString("en-US")}`
    : `$${price}`;
}

type CourierOption = { price: number | null; name: string };

export function StoreDeliveryOptions({
  couriers,
  dict,
}: {
  couriers: CourierOption[];
  dict: Dictionary;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <Truck className="h-5 w-5 text-primary" />
        {dict.store.deliveryOptions}
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {couriers.map((c, i) => (
          <li
            key={i}
            className="flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm"
          >
            <span className="font-semibold">{c.name}</span>
            {c.price != null && (
              <span className="font-bold text-primary">
                {formatPrice(c.price)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
