"use client";

import { useEffect, useState } from "react";

const PIN_LEN = 4;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

type Props = {
  isOpen: boolean;
  title?: string;
  body: string;
  confirmLabel?: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (pin: string) => void;
};

export function PosManagerPinModal({
  isOpen,
  title = "Manager PIN",
  body,
  confirmLabel = "Approve",
  submitting,
  error,
  onClose,
  onConfirm,
}: Props) {
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setPin("");
  }, [isOpen]);

  if (!isOpen) return null;

  function pushDigit(d: string) {
    setPin((prev) => (prev.length >= PIN_LEN ? prev : `${prev}${d}`));
  }

  function submit() {
    if (pin.length !== PIN_LEN || submitting) return;
    onConfirm(pin);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-pin-title"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-gulio-border bg-white shadow-xl">
        <div className="border-b border-gulio-border px-5 py-4">
          <h3 id="pos-pin-title" className="text-lg font-bold text-gulio-text">
            {title}
          </h3>
          <p className="mt-1 text-sm text-gulio-muted">{body}</p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex justify-center gap-2.5" aria-hidden>
            {Array.from({ length: PIN_LEN }).map((_, i) => (
              <span
                key={i}
                className={`flex h-12 w-11 items-center justify-center rounded-xl border-2 text-lg font-bold ${
                  pin.length > i
                    ? "border-teal-600 bg-teal-50 text-teal-800"
                    : "border-gulio-border bg-gulio-bg text-transparent"
                }`}
              >
                {pin.length > i ? "•" : "0"}
              </span>
            ))}
          </div>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={pin}
            maxLength={PIN_LEN}
            aria-label="Manager PIN"
            className="sr-only"
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LEN))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />

          <div className="grid grid-cols-3 gap-2">
            {KEYS.map((key, i) => {
              if (key === "") return <span key={`empty-${i}`} />;
              if (key === "del") {
                return (
                  <button
                    key="del"
                    type="button"
                    onClick={() => setPin((p) => p.slice(0, -1))}
                    className="min-h-touch rounded-xl border border-gulio-border bg-white text-sm font-semibold text-gulio-muted transition hover:bg-gulio-bg"
                  >
                    Delete
                  </button>
                );
              }
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pushDigit(key)}
                  className="min-h-touch rounded-xl border border-gulio-border bg-white text-lg font-semibold tabular-nums text-gulio-text shadow-sm transition hover:border-teal-300 hover:bg-teal-50 active:scale-[0.98]"
                >
                  {key}
                </button>
              );
            })}
          </div>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-11 flex-1 rounded-xl border-2 border-slate-200 bg-white text-sm font-semibold text-gulio-text hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pin.length !== PIN_LEN || submitting}
              className="min-h-11 flex-1 rounded-xl border-2 border-teal-700 bg-teal-600 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {submitting ? "Checking…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
