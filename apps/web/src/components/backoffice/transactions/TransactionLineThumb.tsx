"use client";

import { useState } from "react";

type Size = "sm" | "md";

const sizes: Record<Size, string> = {
  sm: "h-12 w-12 text-[10px]",
  md: "h-14 w-14 text-xs",
};

export function TransactionLineThumb({
  imageUrl,
  name,
  size = "md",
}: {
  imageUrl?: string | null;
  name: string;
  size?: Size;
}) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  const box = sizes[size];

  if (!imageUrl || broken) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-sky-50 font-bold text-teal-700 ring-1 ring-inset ring-gulio-border ${box}`}
      >
        {initials || "?"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt=""
      onError={() => setBroken(true)}
      className={`shrink-0 rounded-xl object-cover ring-1 ring-inset ring-gulio-border ${box}`}
    />
  );
}
