"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasNativeCamera, pickNativeImage } from "@/lib/native";

// Downscale + recompress an image before upload so every asset on the site has a
// sane, consistent weight (phone photos are often 4000px / several MB). Caps the
// longest side to 1600px; keeps PNG (transparency, e.g. logos), else JPEG.
async function downscaleImage(file: File, maxDim = 1600, quality = 0.85): Promise<File> {
  if (
    !file.type.startsWith("image/") ||
    file.type === "image/gif" ||
    file.type === "image/svg+xml"
  ) {
    return file;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  // Already small and light — leave it alone.
  if (scale === 1 && file.size <= 600_000) {
    bitmap.close?.();
    return file;
  }
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob: Blob | null = await new Promise((res) =>
    canvas.toBlob(res, outType, quality),
  );
  if (!blob || blob.size >= file.size) return file; // no gain — keep original
  const base = file.name.replace(/\.[^.]+$/, "");
  const ext = outType === "image/png" ? "png" : "jpg";
  return new File([blob], `${base}.${ext}`, { type: outType });
}

export function ImageUpload({
  folder,
  value,
  onChange,
  label,
}: {
  folder: string;
  value: string | null;
  onChange: (url: string | null) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadFile(rawFile: File) {
    setUploading(true);
    const file = await downscaleImage(rawFile);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("store-assets")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (!error) {
      const { data } = supabase.storage
        .from("store-assets")
        .getPublicUrl(path);
      onChange(data.publicUrl);
    }
    setUploading(false);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  // On the native app, offer the native camera/gallery chooser; on the web,
  // fall back to the hidden file input.
  async function onPick() {
    if (await hasNativeCamera()) {
      try {
        const file = await pickNativeImage("prompt");
        await uploadFile(file);
      } catch {
        /* user cancelled the native picker */
      }
      return;
    }
    inputRef.current?.click();
  }

  return (
    <div>
      <span className="text-sm font-semibold">{label}</span>
      <div className="mt-1.5">
        {value ? (
          <div className="relative h-32 w-full overflow-hidden rounded-xl border border-border">
            <Image src={value} alt="" fill className="object-cover" sizes="400px" />
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label="remove"
              className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPick}
            disabled={uploading}
            className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <ImagePlus className="h-6 w-6" />
            )}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onFile}
          className="hidden"
        />
      </div>
    </div>
  );
}
