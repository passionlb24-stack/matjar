"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";

export function FavoriteButton({
  storeId,
  favorited,
  lang,
  className = "",
}: {
  storeId: string;
  favorited: boolean;
  lang: Locale;
  className?: string;
}) {
  const router = useRouter();
  const [fav, setFav] = useState(favorited);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      router.push(`/${lang}/login`);
      return;
    }
    const next = !fav;
    setFav(next); // optimistic
    const { error } = next
      ? await supabase
          .from("favorites")
          .insert({ store_id: storeId, customer_id: user.id })
      : await supabase
          .from("favorites")
          .delete()
          .eq("store_id", storeId)
          .eq("customer_id", user.id);
    if (error) {
      setFav(!next); // revert on failure
      setBusy(false);
      return;
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label="favorite"
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 backdrop-blur transition-colors hover:bg-surface ${className}`}
    >
      <Heart
        className={`h-4 w-4 ${fav ? "fill-red-500 text-red-500" : "text-foreground/60"}`}
      />
    </button>
  );
}
