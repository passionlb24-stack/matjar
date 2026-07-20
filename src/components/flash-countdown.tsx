"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Live "ends in HH:MM:SS" pill for an active flash sale. Renders nothing once
 * the deadline passes (the server price reverts on the next load anyway).
 */
export function FlashCountdown({
  endsAt,
  dict,
  className = "",
}: {
  endsAt: number;
  dict: Dictionary;
  className?: string;
}) {
  const [remaining, setRemaining] = useState(() => endsAt - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(endsAt - Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (remaining <= 0) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-sm font-bold text-accent-foreground ${className}`}
    >
      <Zap className="h-4 w-4 fill-amber-500 text-amber-500" />
      {dict.flash.endsIn}{" "}
      <span className="tabular-nums">{fmt(remaining)}</span>
    </span>
  );
}
