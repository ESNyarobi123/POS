"use client";

import Image from "next/image";
import Link from "next/link";

type BrandMarkProps = {
  href: string;
  title?: string;
  className?: string;
};

/** Compact login-style logo plate for the top bar. */
export function BrandMark({
  href,
  title = "GulioSmart POS",
  className = "",
}: BrandMarkProps) {
  return (
    <Link
      href={href}
      title={title}
      className={`group inline-flex h-10 shrink-0 items-center rounded-xl bg-[#0f172a] px-2.5 shadow-md shadow-slate-900/20 ring-1 ring-white/10 transition hover:ring-white/20 active:scale-[0.98] ${className}`}
    >
      <span className="relative h-8 w-[138px]">
        <Image
          src="/logo.png"
          alt="GulioSmart"
          fill
          priority
          sizes="138px"
          className="object-contain object-left"
        />
      </span>
    </Link>
  );
}
