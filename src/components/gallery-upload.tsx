"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { ImageUpload } from "@/components/image-upload";

// Multi-image uploader (work samples / extra product shots). Extracted from the
// product edit form so gigs, wholesale and products all share one behaviour:
// thumbnails with a remove button + one "add" slot, capped at `max`.
export function GalleryUpload({
  folder,
  value,
  onChange,
  label,
  max = 6,
}: {
  folder: string;
  value: string[];
  onChange: (urls: string[]) => void;
  label: string;
  max?: number;
}) {
  // Remounting the adder resets its internal preview after each upload.
  const [adderKey, setAdderKey] = useState(0);
  const full = value.length >= max;

  return (
    <div>
      <span className="text-sm font-semibold">
        {label}{" "}
        <span className="font-normal text-muted-foreground">
          ({value.length}/{max})
        </span>
      </span>
      <div className="mt-2 flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div
            key={url}
            className="relative h-20 w-20 overflow-hidden rounded-xl border border-border"
          >
            <Image src={url} alt="" fill className="object-cover" sizes="80px" />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label="remove"
              className="absolute end-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {!full && (
          <div className="w-20">
            <ImageUpload
              key={adderKey}
              folder={folder}
              value={null}
              label=""
              onChange={(url) => {
                if (url && !value.includes(url)) {
                  onChange([...value, url]);
                  setAdderKey((k) => k + 1);
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
