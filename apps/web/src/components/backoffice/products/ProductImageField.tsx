"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Link2, Upload, X } from "lucide-react";

export type ImageSourceMode = "url" | "upload";

type Props = {
  value: string | null | undefined;
  onChange: (value: string) => void;
  onBrokenChange?: (broken: boolean) => void;
  previewBroken?: boolean;
  /** Compact layout for modals */
  compact?: boolean;
  /** Show small preview under the field (off when parent already previews) */
  showInlinePreview?: boolean;
  id?: string;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_MB_LABEL = "5 MB";

const inputClass =
  "w-full rounded-xl border border-gulio-border bg-white px-3.5 py-2.5 text-sm text-gulio-text outline-none transition placeholder:text-gulio-muted/70 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read image"));
    };
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

export function ProductImageField({
  value,
  onChange,
  onBrokenChange,
  previewBroken = false,
  compact = false,
  showInlinePreview = false,
  id,
}: Props) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const fileRef = useRef<HTMLInputElement>(null);
  // Always a string so the URL <input> stays controlled (never undefined/null).
  const safeValue = value ?? "";
  const [mode, setMode] = useState<ImageSourceMode>(() =>
    safeValue.startsWith("data:") ? "upload" : "url",
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const trimmed = safeValue.trim();
  const urlInputValue = safeValue.startsWith("data:") ? "" : safeValue;
  const showPreview =
    (trimmed.startsWith("https://") || trimmed.startsWith("data:image/")) &&
    !previewBroken;

  async function onFilePicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      setUploadError("Choose a JPG, PNG, WebP, or GIF image");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError(`Image must be under ${MAX_MB_LABEL}`);
      return;
    }

    setReading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onChange(dataUrl);
      setFileName(file.name);
      onBrokenChange?.(false);
      setMode("upload");
    } catch {
      setUploadError("Could not read that file");
    } finally {
      setReading(false);
    }
  }

  function clearImage() {
    onChange("");
    setFileName(null);
    setUploadError(null);
    onBrokenChange?.(false);
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div
        className={`inline-flex rounded-xl border border-gulio-border bg-white p-0.5 ${
          compact ? "" : "bg-gulio-bg/80 p-1"
        }`}
        role="group"
        aria-label="Image source"
      >
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold transition ${
            compact ? "min-h-8" : "min-h-9 px-3"
          } ${
            mode === "url"
              ? "bg-teal-600 text-white shadow-sm"
              : "text-gulio-muted hover:text-gulio-text"
          }`}
        >
          <Link2 size={compact ? 14 : 15} />
          URL
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold transition ${
            compact ? "min-h-8" : "min-h-9 px-3"
          } ${
            mode === "upload"
              ? "bg-teal-600 text-white shadow-sm"
              : "text-gulio-muted hover:text-gulio-text"
          }`}
        >
          <Upload size={compact ? 14 : 15} />
          Upload
        </button>
      </div>

      {mode === "url" ? (
        <div className={compact ? "space-y-1" : "space-y-1.5"}>
          {!compact ? (
            <label
              htmlFor={`${fieldId}-url`}
              className="block text-sm font-semibold text-gulio-text"
            >
              Image URL
            </label>
          ) : null}
          <div className="flex gap-2">
            <input
              id={`${fieldId}-url`}
              type="url"
              inputMode="url"
              value={urlInputValue}
              onChange={(e) => {
                onChange(e.target.value);
                setFileName(null);
                onBrokenChange?.(false);
                setUploadError(null);
              }}
              placeholder="https://…"
              className={
                compact
                  ? `${inputClass} py-2`
                  : inputClass
              }
            />
            {compact && trimmed ? (
              <button
                type="button"
                onClick={clearImage}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gulio-border bg-white text-gulio-muted hover:bg-gulio-bg hover:text-gulio-text"
                aria-label="Clear image"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
          {!compact ? (
            <p className="text-xs text-gulio-muted">
              Paste a public https image link
            </p>
          ) : null}
        </div>
      ) : (
        <div className={compact ? "space-y-1" : "space-y-1.5"}>
          {!compact ? (
            <p className="block text-sm font-semibold text-gulio-text">
              Upload image
            </p>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => void onFilePicked(e)}
          />
          {compact ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={reading}
                onClick={() => fileRef.current?.click()}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-gulio-border bg-white px-3 text-sm font-semibold text-gulio-text transition hover:border-teal-400 hover:bg-teal-50/50"
              >
                <ImagePlus size={16} className="text-teal-700" />
                {reading
                  ? "Reading…"
                  : fileName
                    ? "Replace image"
                    : "Choose image"}
              </button>
              {trimmed ? (
                <button
                  type="button"
                  onClick={clearImage}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gulio-border bg-white text-gulio-muted hover:bg-gulio-bg hover:text-gulio-text"
                  aria-label="Clear image"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              disabled={reading}
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gulio-border bg-white px-4 py-6 text-center transition hover:border-teal-400 hover:bg-teal-50/40 min-h-[132px]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <ImagePlus size={20} />
              </span>
              <span className="text-sm font-semibold text-gulio-text">
                {reading ? "Reading image…" : "Click to choose image"}
              </span>
              <span className="text-xs text-gulio-muted">
                JPG, PNG, WebP or GIF · max {MAX_MB_LABEL}
              </span>
            </button>
          )}
          {fileName && !compact ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-gulio-border bg-gulio-bg/60 px-3 py-2 text-xs">
              <span className="truncate font-medium text-gulio-text">
                {fileName}
              </span>
              <button
                type="button"
                onClick={clearImage}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-gulio-muted hover:bg-white hover:text-gulio-text"
              >
                <X size={14} />
                Clear
              </button>
            </div>
          ) : null}
          {uploadError ? (
            <p className="text-xs font-medium text-red-600">{uploadError}</p>
          ) : compact && fileName ? (
            <p className="truncate text-xs text-gulio-muted">{fileName}</p>
          ) : !compact ? (
            <p className="text-xs text-gulio-muted">
              Uploaded images save with the product for now. Cloud storage (MinIO)
              comes next.
            </p>
          ) : null}
        </div>
      )}

      {!compact && mode === "url" && trimmed ? (
        <button
          type="button"
          onClick={clearImage}
          className="text-xs font-semibold text-gulio-muted hover:text-gulio-text"
        >
          Clear image
        </button>
      ) : null}

      {showInlinePreview && showPreview ? (
        <div className="mt-1 overflow-hidden rounded-xl border border-gulio-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={trimmed}
            alt=""
            className="h-24 w-full object-cover"
            onError={() => onBrokenChange?.(true)}
          />
        </div>
      ) : null}
    </div>
  );
}

export function productImagePreviewSrc(
  value: string | null | undefined,
  broken: boolean,
): string | null {
  const trimmed = (value ?? "").trim();
  if (broken) return null;
  if (trimmed.startsWith("https://") || trimmed.startsWith("data:image/")) {
    return trimmed;
  }
  return null;
}
