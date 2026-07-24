"use client";

import { useState } from "react";
import { Send, Megaphone } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

// Admin tool: send a Web Push broadcast to every subscriber (e.g. deal of the
// day). Posts to the admin-gated /api/push/broadcast route.
export function AdminBroadcast({ dict }: { dict: Dictionary }) {
  const t = dict.push;
  const confirm = useConfirm();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    if (!message.trim()) return;
    if (
      !(await confirm({
        message: t.adminConfirm,
        confirmLabel: dict.common.confirm,
        cancelLabel: dict.common.cancel,
      }))
    )
      return;
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

  return (
    <Card>
      <CardBody>
        <h2 className="mb-4 flex items-center gap-2 font-bold">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Megaphone className="h-5 w-5" />
          </span>
          {t.adminTitle}
        </h2>
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.adminHeading}
          />
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t.adminField}
            rows={2}
          />
          <Button
            onClick={send}
            disabled={busy || !message.trim()}
            loading={busy}
            leftIcon={<Send className="h-4 w-4" />}
          >
            {t.adminSend}
          </Button>
          {result && (
            <p className="text-sm font-semibold text-muted-foreground">
              {result}
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
