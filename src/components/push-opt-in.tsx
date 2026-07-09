"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/push";
import type { Dictionary } from "@/i18n/get-dictionary";

type State = "unsupported" | "idle" | "on" | "busy";

// Lets a logged-in user turn on Web Push (deal of the day, order updates…).
export function PushOptIn({ dict }: { dict: Dictionary }) {
  const t = dict.push;
  const [state, setState] = useState<State>("idle");

  // Detect support + existing subscription on mount. State updates here are
  // intentional (kept in an effect to avoid an SSR/CSR hydration mismatch).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setState("unsupported");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "idle"))
      .catch(() => setState("idle"));
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function enable() {
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("idle");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast: a Uint8Array is a valid BufferSource at runtime; TS's newer
        // lib types narrow this and reject the ArrayBufferLike buffer.
        applicationServerKey: urlBase64ToUint8Array(
          VAPID_PUBLIC_KEY,
        ) as BufferSource,
      });
      const json = sub.toJSON();
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !json.keys) {
        setState("idle");
        return;
      }
      await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: sub.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        { onConflict: "endpoint" },
      );
      setState("on");
    } catch {
      setState("idle");
    }
  }

  if (state === "unsupported") return null;

  if (state === "on") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        <Check className="h-4 w-4" />
        {t.enabled}
      </span>
    );
  }

  return (
    <button
      onClick={enable}
      disabled={state === "busy"}
      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
    >
      {state === "busy" ? (
        <BellOff className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {t.enable}
    </button>
  );
}
