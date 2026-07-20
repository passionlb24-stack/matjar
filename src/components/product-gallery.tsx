"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";

export function ProductGallery({
  images,
  alt = "",
}: {
  images: string[];
  alt?: string;
}) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-border bg-surface-muted">
        <ImageIcon className="h-16 w-16 text-foreground/10" />
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border">
        <Image
          src={images[active]}
          alt={alt}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => setActive(i)}
              className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 transition-colors ${
                active === i ? "border-primary" : "border-border"
              }`}
            >
              <Image src={img} alt="" fill className="object-cover" sizes="64px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
