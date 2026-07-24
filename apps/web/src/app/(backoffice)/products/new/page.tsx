"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/backoffice/PageHeader";
import { PermissionGate } from "@/components/backoffice/PermissionGate";
import { PermissionCode } from "@/lib/permissions";

export default function NewProductPage() {
  return (
    <PermissionGate permission={PermissionCode.CATALOG_MANAGE}>
      <NewProductPageInner />
    </PermissionGate>
  );
}

function NewProductPageInner() {
  const [imageUrl, setImageUrl] = useState(
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=640&q=80",
  );
  const [previewBroken, setPreviewBroken] = useState(false);
  const trimmedUrl = imageUrl.trim();
  const showPreview = trimmedUrl.startsWith("https://") && !previewBroken;

  return (
    <div>
      <PageHeader
        title="New product"
        subtitle="Create a catalog item with variants — form is layout-ready (does not persist yet)"
        actions={
          <Link
            href="/products"
            className="inline-flex min-h-touch items-center rounded-xl border border-gulio-border bg-gulio-card px-4 py-2.5 text-sm font-medium text-gulio-text hover:bg-gulio-bg"
          >
            Back to products
          </Link>
        }
      />

      <form
        className="grid gap-6 lg:grid-cols-[1fr_320px]"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="space-y-6">
          <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gulio-muted">
              Basics
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product name" defaultValue="iPhone 16" />
              <Field label="Brand" defaultValue="Apple" />
              <Field label="Category" defaultValue="Phones" />
              <Field
                label="Variant (storage / color)"
                defaultValue="128GB · Black"
              />
              <Field label="SKU" defaultValue="APL-IP16-128-BLK" />
              <Field label="Sell price (TZS)" defaultValue="2,650,000" />
              <Field label="Barcode" defaultValue="GUL-IP16-128-BLK-0001" />
              <div className="flex flex-col justify-end">
                <label className="flex items-start gap-2.5 rounded-xl border border-gulio-border bg-gulio-bg/50 px-3 py-3 text-sm">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="mt-0.5 rounded border-gulio-border text-gulio-primary"
                  />
                  <span>
                    <span className="block font-medium text-gulio-text">
                      Tracks IMEI / serial
                    </span>
                    <span className="mt-0.5 block text-xs text-gulio-muted">
                      Required before sale completes for tracked devices
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gulio-muted">
              Media
            </h2>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="imageUrl">
              Image URL
            </label>
            <input
              id="imageUrl"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                setPreviewBroken(false);
              }}
              className="w-full rounded-xl border border-gulio-border px-3.5 py-2.5 text-sm outline-none ring-gulio-primary focus:ring-2"
            />
            <p className="mt-1.5 text-xs text-gulio-muted">
              Paste an https image link — file upload comes later
            </p>
          </section>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/products"
              className="inline-flex min-h-touch items-center rounded-xl bg-gulio-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gulio-primary-hover"
            >
              Save (mock)
            </Link>
            <Link
              href="/products"
              className="inline-flex min-h-touch items-center rounded-xl border border-gulio-border bg-gulio-card px-5 py-2.5 text-sm font-medium hover:bg-gulio-bg"
            >
              Cancel
            </Link>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-gulio-text">
              Preview
            </p>
            <div className="aspect-square overflow-hidden rounded-xl border border-gulio-border bg-gulio-bg">
              {showPreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- external URL preview
                <img
                  src={trimmedUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setPreviewBroken(true)}
                />
              ) : (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-gulio-muted">
                  {trimmedUrl ? "Invalid or unreachable image" : "No image yet"}
                </div>
              )}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gulio-muted">
              Shown on POS product cards and back-office lists. Prefer a square
              product photo on a clean background.
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Field({
  label,
  defaultValue,
}: {
  label: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gulio-text">
        {label}
      </label>
      <input
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-gulio-border px-3.5 py-2.5 text-sm outline-none ring-gulio-primary focus:ring-2"
      />
    </div>
  );
}
