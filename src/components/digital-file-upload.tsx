"use client";

import { useRef, useState } from "react";
import { FileUp, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type DigitalFile = { path: string; name: string; size: number };

/** Matches the bucket's own limit, so a too-big file is refused here with a
 *  sentence rather than by the server with a status code. */
const MAX_BYTES = 100 * 1024 * 1024;

function humanSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

// Upload for the file behind a digital product.
//
// Deliberately NOT ImageUpload: that one writes to `store-assets`, which is a
// public bucket, and hands back a permanent public URL. Doing that here would
// put the paid file one guessable link away from being free. This writes to the
// private `digital-goods` bucket and keeps only the object PATH — the file
// leaves storage exclusively through a short-lived signed URL, minted by
// /[lang]/download/[itemId] after checking the buyer has an order for it.
export function DigitalFileUpload({
  storeId,
  value,
  onChange,
  label,
  hint,
  uploadingLabel,
  replaceLabel,
  tooLargeLabel,
  failedLabel,
}: {
  storeId: string;
  value: DigitalFile | null;
  onChange: (file: DigitalFile | null) => void;
  label: string;
  hint: string;
  uploadingLabel: string;
  replaceLabel: string;
  tooLargeLabel: string;
  failedLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(tooLargeLabel);
      return;
    }
    setBusy(true);
    // The store id is the first path segment because the storage policy reads
    // it back out of the object name to decide who may write here.
    const path = `${storeId}/${crypto.randomUUID()}`;
    const { error: upErr } = await createClient()
      .storage.from("digital-goods")
      .upload(path, file, { upsert: false });
    setBusy(false);
    if (upErr) {
      setError(failedLabel);
      return;
    }
    onChange({ path, name: file.name, size: file.size });
  }

  return (
    <div>
      <span className="text-sm font-semibold">{label}</span>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>

      {value ? (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-success/30 bg-success-soft px-4 py-3">
          <Check className="h-4 w-4 shrink-0 text-success" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {value.name}
            <span className="ms-2 font-normal text-muted-foreground">
              {humanSize(value.size)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="shrink-0 text-sm font-bold text-muted-foreground transition-colors hover:text-danger"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{replaceLabel}</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-4 text-sm font-bold text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
        >
          <FileUp className="h-4 w-4" />
          {busy ? uploadingLabel : label}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        onChange={onPick}
        className="hidden"
      />
      {error && <p className="mt-1.5 text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
