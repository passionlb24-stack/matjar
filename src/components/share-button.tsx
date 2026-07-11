"use client";

import { useState } from "react";
import { Share2, MessageCircle, Check } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { share } from "@/lib/native";

// Shares the current page. WhatsApp is the dominant sharing channel in Lebanon,
// so it gets a dedicated button; the second button uses the native share sheet
// (mobile) or copies the link (desktop).
export function ShareButton({
  title,
  dict,
}: {
  title: string;
  dict: Dictionary;
}) {
  const [copied, setCopied] = useState(false);

  function whatsappShare() {
    const url = window.location.href;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function nativeShareOrCopy() {
    // Native share sheet in the app, Web Share API in the browser, clipboard
    // as a last resort — the helper picks the best available channel.
    const result = await share({ title, url: window.location.href });
    if (result === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={whatsappShare}
        aria-label="WhatsApp"
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
      >
        <MessageCircle className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={nativeShareOrCopy}
        className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
      >
        {copied ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        {copied ? dict.store.copied : dict.store.share}
      </button>
    </div>
  );
}
