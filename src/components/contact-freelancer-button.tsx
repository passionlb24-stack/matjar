"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export function ContactFreelancerButton({
  freelancerId,
  lang,
  dict,
}: {
  freelancerId: string;
  lang: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/${lang}/login`);
      return;
    }
    if (user.id === freelancerId) {
      setBusy(false);
      return;
    }
    const { data, error } = await supabase.rpc("start_conversation", {
      p_other_user: freelancerId,
    });
    setBusy(false);
    if (!error && data) router.push(`/${lang}/messages/${data}`);
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageSquare className="h-4 w-4" />
      )}
      {dict.freelance.contact}
    </button>
  );
}
