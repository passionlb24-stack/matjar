"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export function FollowButton({
  storeId,
  following,
  lang,
  dict,
}: {
  storeId: string;
  following: boolean;
  lang: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [on, setOn] = useState(following);
  const [busy, setBusy] = useState(false);

  async function toggle() {
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
    const next = !on;
    setOn(next);
    const { error } = next
      ? await supabase.from("follows").insert({ user_id: user.id, store_id: storeId })
      : await supabase
          .from("follows")
          .delete()
          .eq("user_id", user.id)
          .eq("store_id", storeId);
    if (error) {
      setOn(!next);
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
      className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
        on
          ? "bg-primary-soft text-primary"
          : "border border-border hover:border-primary hover:text-primary"
      }`}
    >
      {on ? <Check className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
      {on ? dict.store.following : dict.store.follow}
    </button>
  );
}
