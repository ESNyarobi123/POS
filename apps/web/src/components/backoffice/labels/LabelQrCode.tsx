"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  payload: string;
  size?: number;
  className?: string;
};

/** QR encodes variant identity payload only — never price. */
export function LabelQrCode({ payload, size = 72, className = "" }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!payload.trim()) {
        setDataUrl(null);
        return;
      }
      try {
        const url = await QRCode.toDataURL(payload.trim(), {
          width: size * 2,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#0f172a", light: "#ffffff" },
        });
        if (!cancelled) setDataUrl(url);
      } catch {
        if (!cancelled) setDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payload, size]);

  if (!dataUrl) {
    return (
      <div
        className={`flex items-center justify-center border border-gulio-border bg-white text-[9px] text-gulio-muted ${className}`}
        style={{ width: size, height: size }}
      >
        QR
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- generated data URL
    <img
      src={dataUrl}
      alt=""
      width={size}
      height={size}
      className={`border border-gulio-border bg-white ${className}`}
    />
  );
}
