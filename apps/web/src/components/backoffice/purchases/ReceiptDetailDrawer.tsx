"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Chip,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Skeleton,
} from "@heroui/react";
import type {
  GoodsReceiptDto,
  ReceiptPaymentStatus,
} from "@gulio/contracts";
import {
  formatCount,
  formatDateTime,
  paymentMethodLabel,
} from "@/components/backoffice/dashboard/format";
import { ApiError, apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/money";

type Props = {
  isOpen: boolean;
  receiptId: string | null;
  /** List-row snapshot — shown immediately while the detail request resolves. */
  fallback: GoodsReceiptDto | null;
  onClose: () => void;
  canRecordPayment: boolean;
  onRecordPayment: (receipt: GoodsReceiptDto) => void;
  /** Bump to refetch after a payment is recorded. */
  refreshToken?: number;
};

const btnPrimary =
  "min-h-10 min-w-[136px] rounded-md border-2 border-teal-700 bg-teal-600 font-semibold text-white shadow-sm transition hover:border-teal-800 hover:bg-teal-700";

function paymentChipColor(
  status: ReceiptPaymentStatus,
): "success" | "warning" | "danger" {
  if (status === "PAID") return "success";
  if (status === "PARTIAL") return "warning";
  return "danger";
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gulio-bg/70 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-gulio-text">{value}</p>
    </div>
  );
}

export function ReceiptDetailDrawer({
  isOpen,
  receiptId,
  fallback,
  onClose,
  canRecordPayment,
  onRecordPayment,
  refreshToken = 0,
}: Props) {
  const [receipt, setReceipt] = useState<GoodsReceiptDto | null>(fallback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const detail = await apiFetch<GoodsReceiptDto>(
        `/purchasing/receipts/${id}`,
      );
      setReceipt(detail);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not load receipt detail",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setReceipt(fallback);
    if (!isOpen || !receiptId) return;
    void load(receiptId);
  }, [isOpen, receiptId, fallback, refreshToken, load]);

  const data = receipt;
  const pending = data ? Number(data.pendingTotal) : 0;
  const canPay =
    canRecordPayment && Boolean(data?.supplierId) && pending > 0 && data?.status !== "CANCELLED";

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="lg"
      placement="right"
      scrollBehavior="inside"
      classNames={{
        base: "!bg-white border-l border-gulio-border",
        header: "!bg-white border-b border-gulio-border",
        body: "!bg-white",
        footer: "!bg-white border-t border-gulio-border",
      }}
    >
      <DrawerContent>
        {(close) => (
          <>
            <DrawerHeader className="flex flex-col gap-1 !bg-white px-4 py-3.5">
              <div className="flex w-full items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                    Goods receipt
                  </p>
                  <h2 className="truncate font-mono text-base font-bold tracking-tight text-gulio-text">
                    {data?.invoiceNumber ?? receiptId?.slice(0, 8).toUpperCase() ?? "Receipt"}
                  </h2>
                  <p className="mt-0.5 text-xs text-gulio-muted">
                    {data?.supplierName ?? "—"}
                    {data?.receivedAt ? ` · ${formatDateTime(data.receivedAt)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {data ? (
                    <Chip
                      size="sm"
                      variant="flat"
                      color={paymentChipColor(data.paymentStatus)}
                      className="text-[10px] font-bold uppercase tracking-wide"
                    >
                      {data.paymentStatus}
                    </Chip>
                  ) : null}
                  <Chip
                    size="sm"
                    variant="flat"
                    color={data?.status === "CANCELLED" ? "danger" : "default"}
                    className="text-[10px] font-bold uppercase tracking-wide"
                  >
                    {data?.status ?? "—"}
                  </Chip>
                </div>
              </div>
            </DrawerHeader>

            <DrawerBody className="gap-4 !bg-white px-4 py-4">
              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"
                >
                  {error} — showing the last loaded copy.
                </div>
              ) : null}

              {loading && !data ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-40 w-full rounded-xl" />
                </div>
              ) : null}

              {data ? (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <MetaItem label="Distributor" value={data.supplierName ?? "—"} />
                    <MetaItem label="Branch" value={data.branchName || "—"} />
                    <MetaItem label="Warehouse" value={data.warehouseName || "—"} />
                    <MetaItem
                      label="Received"
                      value={formatDateTime(data.receivedAt)}
                    />
                    <MetaItem label="Received by" value={data.receivedByName ?? "—"} />
                    <MetaItem
                      label="Posted"
                      value={data.postedAt ? formatDateTime(data.postedAt) : "Not posted"}
                    />
                    <MetaItem
                      label="Lines"
                      value={`${formatCount(data.lineCount)} · ${formatCount(data.totalUnits)} units`}
                    />
                    <MetaItem label="Reason" value={data.reason ?? "—"} />
                    <MetaItem label="Notes" value={data.notes ?? "—"} />
                  </div>

                  <section aria-label="Receipt lines">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                      Lines
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-gulio-border">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="border-b border-gulio-border bg-gulio-bg/80 text-[10px] uppercase tracking-wide text-gulio-muted">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Product</th>
                            <th className="px-3 py-2 text-right font-semibold">Qty</th>
                            <th className="px-3 py-2 text-right font-semibold">Wholesale</th>
                            <th className="px-3 py-2 text-right font-semibold">Retail</th>
                            <th className="px-3 py-2 text-right font-semibold">Margin / unit</th>
                            <th className="px-3 py-2 text-right font-semibold">Line total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.lines.map((line) => (
                            <tr
                              key={line.id}
                              className="border-b border-gulio-border/70 last:border-0 align-top"
                            >
                              <td className="px-3 py-2.5">
                                <p className="text-[13px] font-semibold text-gulio-text">
                                  {line.productName}
                                </p>
                                <p className="text-[11px] text-gulio-muted">
                                  {line.variantName}
                                  {line.sku ? ` · ${line.sku}` : ""}
                                </p>
                                {line.tracksSerial ? (
                                  <details className="mt-1.5">
                                    <summary className="cursor-pointer text-[11px] font-semibold text-teal-700">
                                      {line.serialNumbers.length} IMEI / serial
                                      {line.serialNumbers.length === 1 ? "" : "s"}
                                    </summary>
                                    <ul className="mt-1 space-y-0.5">
                                      {line.serialNumbers.map((serial) => (
                                        <li
                                          key={serial}
                                          className="font-mono text-[11px] text-gulio-muted"
                                        >
                                          {serial}
                                        </li>
                                      ))}
                                    </ul>
                                  </details>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {formatCount(Number(line.quantity))}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {formatMoney(line.unitCost)}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-gulio-muted">
                                {formatMoney(line.retailPrice)}
                              </td>
                              <td
                                className={`px-3 py-2.5 text-right tabular-nums ${
                                  Number(line.marginPerUnit) >= 0
                                    ? "text-emerald-700"
                                    : "text-rose-700"
                                }`}
                              >
                                {formatMoney(line.marginPerUnit)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                                {formatMoney(line.lineTotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section
                    aria-label="Receipt totals"
                    className="rounded-xl border border-gulio-border bg-gulio-bg/50 p-3.5"
                  >
                    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                          Subtotal
                        </dt>
                        <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                          {formatMoney(data.subtotal)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                          Discount
                        </dt>
                        <dd className="mt-0.5 text-sm font-semibold tabular-nums text-amber-700">
                          −{formatMoney(data.discountTotal)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                          Tax
                        </dt>
                        <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                          {formatMoney(data.taxTotal)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                          Total
                        </dt>
                        <dd className="mt-0.5 text-base font-bold tabular-nums text-gulio-text">
                          {formatMoney(data.total)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                          Paid
                        </dt>
                        <dd className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-700">
                          {formatMoney(data.paidTotal)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                          Pending
                        </dt>
                        <dd className="mt-0.5 text-sm font-semibold tabular-nums text-amber-700">
                          {formatMoney(data.pendingTotal)}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section aria-label="Payment history">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                      Payment history
                    </p>
                    {data.payments.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-gulio-border px-3.5 py-4 text-sm text-gulio-muted">
                        No payments recorded against this receipt yet.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {data.payments.map((payment) => (
                          <li
                            key={payment.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-gulio-border px-3.5 py-2.5 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-gulio-text">
                                {paymentMethodLabel(payment.method)}
                                {payment.reference ? (
                                  <span className="ml-2 font-mono text-[11px] font-normal text-gulio-muted">
                                    {payment.reference}
                                  </span>
                                ) : null}
                              </p>
                              <p className="text-[11px] text-gulio-muted">
                                {formatDateTime(payment.paidAt)}
                                {payment.recordedByName
                                  ? ` · ${payment.recordedByName}`
                                  : ""}
                              </p>
                            </div>
                            <span className="shrink-0 font-semibold tabular-nums text-emerald-700">
                              {formatMoney(payment.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              ) : null}
            </DrawerBody>

            <DrawerFooter className="justify-between gap-2.5 !bg-white px-4 py-3.5">
              <Button
                variant="bordered"
                radius="md"
                onPress={close}
                className="min-h-10 rounded-md border-2 border-slate-200 bg-white font-semibold text-gulio-text"
              >
                Close
              </Button>
              {data ? (
                <Button
                  color="primary"
                  radius="md"
                  isDisabled={!canPay}
                  onPress={() => onRecordPayment(data)}
                  className={btnPrimary}
                >
                  Record payment
                </Button>
              ) : null}
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
