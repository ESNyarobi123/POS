import Link from "next/link";
import { formatTzs, products } from "@/lib/mock-data";

export default function ScanPricePage() {
  const sample = products[1];

  return (
    <div className="mx-auto min-h-screen max-w-md bg-gulio-bg p-4">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gulio-primary">
            Mobile scanner
          </p>
          <h1 className="text-xl font-bold">Price check</h1>
        </div>
        <Link href="/pos" className="text-sm text-gulio-primary underline">
          POS
        </Link>
      </header>

      <div className="rounded-xl border border-gulio-border bg-gulio-card p-4 shadow-sm">
        <label className="mb-1 block text-sm font-medium" htmlFor="scan">
          Scan barcode / QR
        </label>
        <input
          id="scan"
          autoFocus
          placeholder="Point scanner or type SKU…"
          defaultValue={sample.barcode}
          className="w-full rounded-lg border border-gulio-border px-3 py-3 text-base outline-none ring-gulio-primary focus:ring-2"
        />
      </div>

      <div className="mt-4 rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
        <p className="text-sm text-gulio-muted">{sample.category}</p>
        <p className="mt-1 text-lg font-bold">{sample.name}</p>
        <p className="text-sm text-gulio-muted">{sample.variant}</p>
        <p className="mt-4 text-3xl font-bold tabular-nums text-gulio-primary">
          {formatTzs(sample.priceMinor)}
        </p>
        <p className="mt-2 text-sm text-gulio-muted">
          Live price from catalog · stock {sample.stock}
          {sample.tracksSerial ? " · serial tracked" : ""}
        </p>
        <p className="mt-1 font-mono text-xs text-gulio-muted">{sample.sku}</p>
      </div>

      <nav className="mt-8 grid grid-cols-2 gap-2 text-center text-sm">
        <Stub href="#" label="IMEI check" />
        <Stub href="/inventory" label="Stock" />
        <Stub href="/labels" label="Labels" />
        <Stub href="/products" label="Catalog" />
      </nav>

      <p className="mt-6 text-center text-xs text-gulio-muted">
        Scanner stub — Phase 1 mobile assist
      </p>
    </div>
  );
}

function Stub({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-gulio-border bg-white py-3 font-medium text-gulio-text hover:border-gulio-primary"
    >
      {label}
    </Link>
  );
}
