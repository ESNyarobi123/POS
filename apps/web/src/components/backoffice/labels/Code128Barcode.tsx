"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

type Props = {
  value: string;
  height?: number;
  displayValue?: boolean;
  className?: string;
};

/** Renders a real Code 128 barcode as SVG. */
export function Code128Barcode({
  value,
  height = 48,
  displayValue = false,
  className = "",
}: Props) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value.trim()) return;
    try {
      JsBarcode(ref.current, value.trim(), {
        format: "CODE128",
        width: 1.6,
        height,
        displayValue,
        margin: 0,
        background: "#ffffff",
        lineColor: "#0f172a",
        fontSize: 11,
      });
    } catch {
      // Invalid characters for Code128 — leave empty svg
      const svg = ref.current;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
    }
  }, [value, height, displayValue]);

  if (!value.trim()) {
    return (
      <p className="text-center text-[10px] text-gulio-muted">No barcode</p>
    );
  }

  return (
    <svg
      ref={ref}
      className={`mx-auto max-w-full ${className}`}
      role="img"
      aria-label={`Barcode ${value}`}
    />
  );
}
