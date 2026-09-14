"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import type { ProductListItemDto } from "@gulio/contracts";
import { PageHeader } from "@/components/backoffice/PageHeader";
import { PermissionGate } from "@/components/backoffice/PermissionGate";
import {
  ProductImageField,
  productImagePreviewSrc,
} from "@/components/backoffice/products/ProductImageField";
import { ApiError, apiFetch } from "@/lib/api";
import { PermissionCode } from "@/lib/permissions";

export default function EditProductPage() {
  return (
    <PermissionGate permission={PermissionCode.CATALOG_MANAGE}>
      <EditProductPageInner />
    </PermissionGate>
  );
}

function EditProductPageInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [previewBroken, setPreviewBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const product = await apiFetch<ProductListItemDto>(
          `/catalog/products/${id}`,
        );
        if (cancelled) return;
        setName(product.name);
        setDescription(product.description ?? "");
        setImageUrl(product.imageUrl ?? "");
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof ApiError ? e.message : "Could not load product",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const trimmedUrl = imageUrl.trim();
  const previewSrc = productImagePreviewSrc(imageUrl, previewBroken);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/catalog/products/${id}`, {
        method: "PATCH",
        body: {
          name: name.trim(),
          description: description.trim() || null,
          imageUrl: imageUrl.trim() || null,
        },
      });
      router.push("/products");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Edit product"
        subtitle="Update name, description, and image. Variants stay on the catalog card."
        actions={
          <Link
            href="/products"
            className="inline-flex min-h-touch items-center rounded-xl border border-gulio-border bg-gulio-card px-4 py-2.5 text-sm font-medium text-gulio-text hover:bg-gulio-bg"
          >
            Back to products
          </Link>
        }
      />

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-gulio-card" />
      ) : (
        <form
          className="grid gap-6 lg:grid-cols-[1fr_320px]"
          onSubmit={(e) => void onSubmit(e)}
        >
          <div className="space-y-6">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm sm:p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gulio-muted">
                Basics
              </h2>
              <div className="grid gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-gulio-text">
                    Product name
                  </span>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-gulio-border px-3.5 py-2.5 text-sm outline-none ring-gulio-primary focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-gulio-text">
                    Description
                  </span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-gulio-border px-3.5 py-2.5 text-sm outline-none ring-gulio-primary focus:ring-2"
                  />
                </label>
                <div>
                  <span className="mb-2 block text-sm font-medium text-gulio-text">
                    Product image
                  </span>
                  <ProductImageField
                    id="edit-page-image"
                    value={imageUrl}
                    onChange={setImageUrl}
                    previewBroken={previewBroken}
                    onBrokenChange={setPreviewBroken}
                  />
                </div>
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                color="primary"
                className="min-h-11 font-semibold"
                isLoading={saving}
              >
                Save changes
              </Button>
              <Button
                type="button"
                variant="bordered"
                className="min-h-11"
                onPress={() => router.push("/products")}
              >
                Cancel
              </Button>
            </div>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-gulio-text">
                Preview
              </p>
              <div className="aspect-square overflow-hidden rounded-xl border border-gulio-border bg-gulio-bg">
                {previewSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL / data URL preview
                  <img
                    src={previewSrc}
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
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}
