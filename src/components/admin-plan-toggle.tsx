"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function AdminPlanToggle({
  storeId,
  plan,
  proLabel,
  freeLabel,
}: {
  storeId: string;
  plan: "free" | "pro";
  proLabel: string;
  freeLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isPro = plan === "pro";

  async function setPlan(next: "free" | "pro") {
    setBusy(true);
    await createClient()
      .from("stores")
      .update({ plan: next, is_verified: next === "pro" })
      .eq("id", storeId);
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={() => setPlan(isPro ? "free" : "pro")}
      disabled={busy}
      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-bold transition-colors disabled:opacity-60 ${
        isPro
          ? "border border-border text-muted-foreground hover:bg-surface-muted"
          : "bg-amber-500 text-white hover:bg-amber-600"
      }`}
    >
      <Crown className="h-4 w-4" />
      {isPro ? freeLabel : proLabel}
    </button>
  );
}
