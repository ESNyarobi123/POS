"use client";

import { useEffect, useState } from "react";
import type { OpticEdgeChannelDto, OpticEdgeChannelsResponse } from "@gulio/contracts";
import { ApiError, apiFetch } from "@/lib/api";
import { formatMoney, type DecimalString } from "@/lib/money";

type Props = {
  amount: DecimalString;
  online: boolean;
  onConfirm: (channel: OpticEdgeChannelDto) => void;
  onClose: () => void;
};

function typeLabel(type: string): string {
  const t = type.trim().toLowerCase();
  if (t === "cash") return "Cash";
  if (t === "bank") return "Bank";
  if (t === "mobile") return "Mobile";
  return type || "Other";
}

export function PosBankChannelModal({
  amount,
  online,
  onConfirm,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<OpticEdgeChannelDto[]>([]);
  const [configured, setConfigured] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<OpticEdgeChannelsResponse>(
          "/payments/opticedge/channels",
        );
        if (cancelled) return;
        setConfigured(data.configured);
        setEnabled(data.enabled);
        setChannels(data.channels);
        if (!data.configured || !data.enabled) {
          setError(
            "Save OpticEdge APIs in Settings, then pick how the customer paid.",
          );
        } else if (data.channels.length === 0) {
          setError("No channels returned. Check the OpticEdge API token.");
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Could not load payment channels",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = channels.find((c) => c.id === selectedId) ?? null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-end bg-slate-900/40 p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bank-channel-title"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85%] w-full flex-col overflow-hidden rounded-gulio border border-gulio-border bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-2 border-b border-gulio-border px-3.5 py-3">
          <div className="min-w-0">
            <h3
              id="bank-channel-title"
              className="text-sm font-semibold text-gulio-text"
            >
              How did the customer pay?
            </h3>
            <p className="mt-0.5 text-xs text-gulio-muted">
              Choose the OpticEdge channel. Sale stays on this POS.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-gulio-muted hover:bg-gulio-bg hover:text-gulio-text"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="border-b border-gulio-border bg-gulio-bg/70 px-3.5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
            Amount due
          </p>
          <p className="text-lg font-bold tabular-nums text-gulio-text">
            {formatMoney(amount)}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-3.5 py-3">
          {!online ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
              Connect to the internet to load bank channels.
            </p>
          ) : null}

          {loading ? (
            <p className="py-6 text-center text-sm text-gulio-muted">
              Loading channels…
            </p>
          ) : (
            <ul className="space-y-2">
              {channels.map((channel) => {
                const active = channel.id === selectedId;
                return (
                  <li key={channel.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(channel.id)}
                      className={`flex w-full min-h-touch items-center justify-between gap-3 rounded-gulio border px-3 py-3 text-left transition ${
                        active
                          ? "border-gulio-primary bg-teal-50 ring-2 ring-teal-500/20"
                          : "border-gulio-border bg-white hover:border-teal-200"
                      }`}
                    >
                      <span>
                        <span className="block text-sm font-semibold text-gulio-text">
                          {channel.name}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-gulio-muted">
                          {typeLabel(channel.type)}
                          {channel.currency ? ` · ${channel.currency}` : ""}
                        </span>
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          channel.type === "cash"
                            ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
                            : "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200"
                        }`}
                      >
                        {typeLabel(channel.type)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-gulio-error"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-[1fr_2fr] gap-2 border-t border-gulio-border p-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-touch rounded-gulio border border-gulio-border bg-transparent text-sm font-semibold text-gulio-muted transition hover:bg-white hover:text-gulio-text active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected || !online || !enabled || !configured}
            onClick={() => {
              if (!selected) return;
              onConfirm(selected);
            }}
            className="min-h-touch rounded-gulio bg-gulio-success text-sm font-bold tracking-wide text-white shadow-sm ring-2 ring-green-600/20 transition hover:bg-green-700 active:scale-[0.98] disabled:opacity-50"
          >
            {selected ? `Pay · ${selected.name}` : "Select channel"}
          </button>
        </div>
      </div>
    </div>
  );
}
