"use client";

import { useState } from "react";
import { Send, Megaphone } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";

// Admin tool: send a Web Push broadcast to every subscriber (e.g. deal of the
// day). Posts to the admin-gated /api/push/broadcast route.
export function AdminBroadcast({ dict }: { dict: Dictionary }) {
  const t = dict.push;
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    if (!message.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/push/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message }),
      });
      const data = await res.json();
      if (res.status === 503) setResult(t.adminNotConfigured);
      else if (res.ok) {
        setResult(`${t.adminSent} ${data.sent}/${data.total}`);
        setMessage("");
        setTitle("");
      } else setResult(dict.auth.errorGeneric);
    } catch {
      setResult(dict.auth.errorGeneric);
    }
    setBusy(false);
  }

  const field =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-3 flex items-center gap-2 font-bold">
        <Megaphone className="h-5 w-5 text-primary" />
        {t.adminTitle}
      </h2>
      <div className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.adminHeading}
          className={field}
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t.adminField}
          rows={2}
          className={field}
        />
        <button
          onClick={send}
          disabled={busy || !message.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {t.adminSend}
        </button>
        {result && (
          <p className="text-sm font-semibold text-muted-foreground">{result}</p>
        )}
      </div>
    </div>
  );
}
