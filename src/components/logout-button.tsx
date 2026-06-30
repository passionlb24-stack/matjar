"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();

  async function onClick() {
    await createClient().auth.signOut();
    router.refresh();
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
    >
      <LogOut className="h-4 w-4" />
      {label}
    </button>
  );
}
