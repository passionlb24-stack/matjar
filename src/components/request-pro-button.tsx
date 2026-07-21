"use client";

import { useState } from "react";
import { Crown, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";

// A free store owner requests a Pro upgrade for THEIR store (payment is manual).
// Captures a phone so the admin can call back; notifies admins — no need to
// re-create a store.
export function RequestProButton({
  storeId,
  requestLabel,
  sentLabel,
  phonePlaceholder,
}: {
  storeId: string;
  requestLabel: string;
  sentLabel: string;
  phonePlaceholder: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [phone, setPhone] = useState("");

  async function request() {
    if (state !== "idle") return;
    setState("busy");
    const { error } = await createClient().rpc("request_pro_upgrade", {
      p_store_id: storeId,
      p_phone: phone.trim() || null,
    });
    if (error) {
      setState("idle");
      notifyError(error.message ?? "");
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <p className="mt-4 flex items-center gap-1.5 text-sm font-bold text-success">
        <Check className="h-4 w-4" />
        {sentLabel}
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder={phonePlaceholder}
        inputMode="tel"
        dir="ltr"
        className="h-11 flex-1 rounded-xl border border-warning/30 bg-surface px-3.5 text-sm outline-none transition-colors focus:border-amber-500"
      />
      <button
        onClick={request}
        disabled={state === "busy"}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-5 text-sm font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
      >
        <Crown className="h-4 w-4" />
        {requestLabel}
      </button>
    </div>
  );
}
