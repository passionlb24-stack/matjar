"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, Download, QrCode as QrIcon } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";

// Merchant acquisition/marketing tool: a short store link + printable QR the
// merchant can put on their storefront, receipt, or Instagram story.
export function StoreShareCard({
  code,
  baseUrl,
  dict,
}: {
  code: string;
  baseUrl: string;
  dict: Dictionary;
}) {
  const t = dict.share;
  const shortUrl = `${baseUrl}/s/${code}`;
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(shortUrl, { width: 512, margin: 2 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [shortUrl]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-1 flex items-center gap-2 font-bold">
        <QrIcon className="h-5 w-5 text-primary" />
        {t.title}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">{t.subtitle}</p>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {qr && (
          // Data-URL QR generated client-side; next/image can't optimize it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt={t.title}
            width={128}
            height={128}
            className="h-32 w-32 rounded-xl border border-border"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2">
            <span dir="ltr" className="min-w-0 flex-1 truncate text-sm font-semibold">
              {shortUrl}
            </span>
            <button
              onClick={copy}
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary-soft"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? t.copied : t.copy}
            </button>
          </div>
          {qr && (
            <a
              href={qr}
              download={`matjar-${code}.png`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <Download className="h-4 w-4" />
              {t.download}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
