"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { releaseDeviceOnSignOut } from "@/lib/native-push";

export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();

  async function onClick() {
    const supabase = createClient();
    // Release this phone's push token BEFORE dropping the session.
    //
    // The RLS delete policy on device_push_tokens is `user_id = auth.uid()`, so
    // once signOut() has run this client can no longer delete the row — and a
    // row that outlives the session is not a tidiness problem. It is the
    // previous account's notifications arriving on a phone somebody else is now
    // signed in on. The register RPC does reassign a token on conflict, but only
    // if the next person opts in; if they never do, the row keeps pointing at
    // whoever signed out.
    //
    // A no-op on the web, where there is no device token.
    await releaseDeviceOnSignOut(supabase);
    await supabase.auth.signOut();
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
