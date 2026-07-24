"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/backoffice/PageHeader";
import { products } from "@/lib/mock-data";

export default function LabelsPage() {
  const [selectedId, setSelectedId] = useState(products[0]?.id ?? "");
  const sample = useMemo(
    () => products.find((p) => p.id === selectedId) ?? products[0],
    [selectedId],
  );

  if (!sample) {
    return null;
  }

  return (
    <div>
      <PageHeader
        title="Barcode labels"
        subtitle="QR carries product id only — never price as source of truth. Scan fetches live price."
        actions={
          <button
            type="button"
            className="inline-flex min-h-touch items-center rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gulio-primary-hover"
          >
            Print selected (mock)
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-xl border border-gulio-border bg-gulio-card p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gulio-muted">
            Select product
          </p>
          <ul className="max-h-[420px] space-y-1 overflow-y-auto">
            {products.map((p) => {
              const active = p.id === sample.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-sky-50 font-medium text-sky-900 ring-1 ring-sky-200"
                        : "hover:bg-gulio-bg text-gulio-text"
                    }`}
                  >
                    <span className="block truncate">{p.name}</span>
                    <span className="block truncate text-xs text-gulio-muted">
                      {p.variant}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="space-y-6">
          <div className="flex flex-wrap gap-6">
            <LabelCard
              name={sample.name}
              variant={sample.variant}
              barcode={sample.barcode}
              productId={sample.id}
            />
            <LabelCard
              name={sample.name}
              variant={sample.variant}
              barcode={sample.barcode}
              productId={sample.id}
              compact
            />
          </div>

          <div className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
            <h2 className="font-semibold text-gulio-text">Label rules</h2>
            <ul className="mt-3 space-y-2 text-sm text-gulio-muted">
              <li>
                <strong className="text-gulio-text">Code 128</strong> when
                manufacturer barcode is missing (e.g.{" "}
                <code className="rounded bg-gulio-bg px-1.5 py-0.5 font-mono text-xs">
                  {sample.barcode}
                </code>
                ).
              </li>
              <li>
                QR encodes product URL / signed id only — POS and scanner always
                resolve live sell price from the API.
              </li>
              <li>
                Print queue + templates ship with{" "}
                <code className="rounded bg-gulio-bg px-1.5 py-0.5 text-xs">
                  @gulio/barcode
                </code>{" "}
                / printing packages.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function LabelCard({
  name,
  variant,
  barcode,
  productId,
  compact = false,
}: {
  name: string;
  variant: string;
  barcode: string;
  productId: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border-2 border-dashed border-sky-200 bg-gulio-card text-center shadow-sm ${
        compact ? "w-48 p-3" : "w-72 p-5"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-gulio-primary">
        GulioSmart
      </p>
      <p
        className={`mt-2 font-bold leading-tight text-gulio-text ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        {name}
      </p>
      <p className="text-[11px] text-gulio-muted">{variant}</p>
      <div
        className={`mx-auto my-3 flex w-full items-end justify-center gap-px px-1 ${
          compact ? "h-10" : "h-14"
        }`}
      >
        {Array.from({ length: compact ? 32 : 48 }).map((_, i) => (
          <span
            key={i}
            className="bg-gulio-text"
            style={{
              width: i % 3 === 0 ? 2 : 1,
              height: (compact ? 12 : 18) + ((i * 7) % (compact ? 18 : 28)),
            }}
          />
        ))}
      </div>
      <p className="font-mono text-[10px] text-gulio-text">{barcode}</p>
      <div
        className={`mx-auto mt-3 flex items-center justify-center border border-gulio-border bg-white ${
          compact ? "h-10 w-10" : "h-14 w-14"
        }`}
      >
        <span className="grid grid-cols-5 gap-px">
          {Array.from({ length: 25 }).map((_, i) => (
            <span
              key={i}
              className={`${compact ? "h-1 w-1" : "h-1.5 w-1.5"} ${
                (i * 3) % 4 === 0 ? "bg-gulio-text" : "bg-transparent"
              }`}
            />
          ))}
        </span>
      </div>
      <p className="mt-2 text-[10px] text-gulio-muted">
        QR → /p/{productId}
      </p>
    </div>
  );
}
