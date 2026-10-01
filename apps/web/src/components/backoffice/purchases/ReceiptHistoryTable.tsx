"use client";

import { useMemo } from "react";
import {
  Chip,
  Pagination,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  type SortDescriptor,
} from "@heroui/react";
import type { GoodsReceiptDto, ReceiptPaymentStatus } from "@gulio/contracts";
import { EmptyState } from "@/components/backoffice/EmptyState";
import {
  formatCount,
  formatDateShort,
} from "@/components/backoffice/dashboard/format";
import { formatMoney } from "@/lib/money";
import type { ReceiptColumnDef, ReceiptColumnKey } from "./receipt-columns";

type Props = {
  items: GoodsReceiptDto[];
  columns: ReceiptColumnDef[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  sortDescriptor: SortDescriptor;
  onSortChange: (descriptor: SortDescriptor) => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onOpenReceipt: (receipt: GoodsReceiptDto) => void;
};

/** Columns whose values repeat once per receipt line. */
const LINE_COLUMNS = new Set<ReceiptColumnKey>([
  "product",
  "qty",
  "wholesale",
  "retail",
]);

const LINE_ROW = "flex h-9 items-center";

function paymentChipColor(
  status: ReceiptPaymentStatus,
): "success" | "warning" | "danger" {
  if (status === "PAID") return "success";
  if (status === "PARTIAL") return "warning";
  return "danger";
}

function latestPaidAt(receipt: GoodsReceiptDto): string | null {
  let latest: string | null = null;
  for (const payment of receipt.payments) {
    if (!latest || new Date(payment.paidAt).getTime() > new Date(latest).getTime()) {
      latest = payment.paidAt;
    }
  }
  return latest;
}

function alignClass(column: ReceiptColumnDef): string {
  if (column.align === "end") return "text-right";
  if (column.align === "center") return "text-center";
  return "text-left";
}

export function ReceiptHistoryTable({
  items,
  columns,
  loading,
  error,
  onRetry,
  sortDescriptor,
  onSortChange,
  page,
  pageSize,
  total,
  onPageChange,
  onOpenReceipt,
}: Props) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  const rangeLabel = useMemo(() => {
    if (total === 0) return "No receipts";
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(total, page * pageSize);
    return `Showing ${start}–${end} of ${total}`;
  }, [page, pageSize, total]);

  function renderCell(receipt: GoodsReceiptDto, key: ReceiptColumnKey) {
    switch (key) {
      case "invoice":
        return (
          <div className="min-w-0">
            <p className="truncate font-mono text-[12px] font-semibold text-gulio-text">
              {receipt.invoiceNumber ?? receipt.id.slice(0, 8).toUpperCase()}
            </p>
            {receipt.status !== "POSTED" ? (
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                {receipt.status}
              </p>
            ) : null}
          </div>
        );

      case "date":
        return (
          <span className="text-xs tabular-nums text-gulio-text">
            {formatDateShort(receipt.receivedAt)}
          </span>
        );

      case "branch":
        return (
          <span className="text-xs text-gulio-text">{receipt.branchName || "—"}</span>
        );

      case "distributor":
        return (
          <span className="truncate text-xs text-gulio-text">
            {receipt.supplierName ?? "—"}
          </span>
        );

      case "product":
        return (
          <div className="min-w-0 space-y-0">
            {receipt.lines.map((line) => (
              <div key={line.id} className={`${LINE_ROW} min-w-0 gap-2`}>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold leading-tight text-gulio-text">
                    {line.productName}
                  </p>
                  <p className="truncate text-[10px] leading-tight text-gulio-muted">
                    {line.variantName}
                    {line.sku ? ` · ${line.sku}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        );

      case "qty":
        return (
          <div>
            {receipt.lines.map((line) => (
              <div
                key={line.id}
                className={`${LINE_ROW} justify-end text-xs font-semibold tabular-nums text-gulio-text`}
              >
                {formatCount(Number(line.quantity))}
              </div>
            ))}
          </div>
        );

      case "wholesale":
        return (
          <div>
            {receipt.lines.map((line) => (
              <div
                key={line.id}
                className={`${LINE_ROW} justify-end text-xs tabular-nums text-gulio-text`}
              >
                {formatMoney(line.unitCost)}
              </div>
            ))}
          </div>
        );

      case "retail":
        return (
          <div>
            {receipt.lines.map((line) => (
              <div
                key={line.id}
                className={`${LINE_ROW} justify-end text-xs tabular-nums text-gulio-muted`}
              >
                {formatMoney(line.retailPrice)}
              </div>
            ))}
          </div>
        );

      case "total":
        return (
          <span className="text-sm font-bold tabular-nums text-gulio-text">
            {formatMoney(receipt.total)}
          </span>
        );

      case "paidDate": {
        const paidAt = latestPaidAt(receipt);
        return (
          <span className="text-xs tabular-nums text-gulio-muted">
            {paidAt ? formatDateShort(paidAt) : "—"}
          </span>
        );
      }

      case "paid":
        return (
          <span className="text-xs font-semibold tabular-nums text-emerald-700">
            {formatMoney(receipt.paidTotal)}
          </span>
        );

      case "pending": {
        const pending = Number(receipt.pendingTotal);
        return (
          <span
            className={`text-xs font-semibold tabular-nums ${
              pending > 0 ? "text-amber-700" : "text-gulio-muted"
            }`}
          >
            {formatMoney(receipt.pendingTotal)}
          </span>
        );
      }

      case "status":
        return (
          <div className="flex flex-col items-center gap-1">
            <Chip
              size="sm"
              variant="flat"
              color={paymentChipColor(receipt.paymentStatus)}
              className="h-5 px-2 text-[10px] font-bold uppercase tracking-wide"
            >
              {receipt.paymentStatus}
            </Chip>
            {receipt.status === "DRAFT" ? (
              <Chip
                size="sm"
                variant="flat"
                color="default"
                className="h-4 px-1.5 text-[9px] font-bold uppercase tracking-wide"
              >
                Draft
              </Chip>
            ) : null}
            {receipt.status === "CANCELLED" ? (
              <Chip
                size="sm"
                variant="flat"
                color="danger"
                className="h-4 px-1.5 text-[9px] font-bold uppercase tracking-wide"
              >
                Cancelled
              </Chip>
            ) : null}
          </div>
        );

      default:
        return null;
    }
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900"
      >
        <div>
          <p className="font-semibold">Could not load receipt history</p>
          <p className="mt-0.5 text-rose-800">{error}</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-9 items-center rounded-lg border border-rose-300 bg-white px-3 text-xs font-semibold text-rose-800 transition hover:bg-rose-100"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gulio-border bg-gulio-card shadow-sm">
      <div className="overflow-x-auto">
        <Table
          aria-label="Goods receipt history"
        removeWrapper
        isHeaderSticky
        sortDescriptor={sortDescriptor}
        onSortChange={onSortChange}
        onRowAction={(key) => {
          const receipt = items.find((r) => r.id === String(key));
          if (receipt) onOpenReceipt(receipt);
        }}
        classNames={{
          table: "min-w-[1180px]",
          thead: "[&>tr]:bg-gulio-bg/80",
          th: "border-b border-gulio-border bg-transparent text-[10px] font-bold uppercase tracking-wider text-gulio-muted",
          td: "border-b border-gulio-border/70",
          tr: "cursor-pointer transition-colors hover:bg-teal-50/40 data-[selected=true]:bg-teal-50/60",
          sortIcon: "text-teal-600",
        }}
      >
        <TableHeader columns={columns}>
          {(column) => (
            <TableColumn
              key={column.key}
              allowsSorting={Boolean(column.sortKey)}
              align={column.align ?? "start"}
              width={column.width}
            >
              {column.label}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody
          items={items}
          isLoading={loading}
          loadingContent={
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          }
          emptyContent={
            <EmptyState
              title="No receipts match"
              description="Adjust the search or filters above, or add a receive line to post a new goods receipt."
            />
          }
        >
          {(receipt) => (
            <TableRow key={receipt.id}>
              {(columnKey) => {
                const key = columnKey as ReceiptColumnKey;
                const column = columns.find((c) => c.key === key);
                const isLine = LINE_COLUMNS.has(key);
                return (
                  <TableCell
                    className={`px-3 py-2 ${isLine ? "align-top" : "align-middle"} ${
                      column ? alignClass(column) : ""
                    }`}
                  >
                    {renderCell(receipt, key)}
                  </TableCell>
                );
              }}
            </TableRow>
          )}
        </TableBody>
        </Table>
      </div>

      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gulio-border bg-gulio-bg/40 px-4 py-2.5">
          <p className="text-xs text-gulio-muted">{rangeLabel}</p>
          <Pagination
            size="sm"
            showControls
            total={pages}
            page={page}
            onChange={onPageChange}
            classNames={{ cursor: "bg-teal-600" }}
          />
        </div>
      ) : null}
    </div>
  );
}
