"use client";

import { useState } from "react";

type Props = {
  imageUrl: string | null;
  name: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ProductThumb({ imageUrl, name }: Props) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(imageUrl) && !broken;

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gulio-bg text-[11px] font-semibold text-gulio-muted ring-1 ring-gulio-border">
      {showImage && imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- external seed URLs
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </div>
  );
}
