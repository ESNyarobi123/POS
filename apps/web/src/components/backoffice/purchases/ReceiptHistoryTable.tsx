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
import { ChevronRight, PackageSearch, ReceiptText } from "lucide-react";
import type { GoodsReceiptDto, ReceiptPaymentStatus } from "@gulio/contracts";
import { EmptyState } from "@/components/backoffice/EmptyState";
import { ProductThumb } from "@/components/backoffice/ProductThumb";
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

const LINE_ROW = "flex h-10 items-center";

function paymentChipColor(
  status: ReceiptPaymentStatus,
): "success" | "warning" | "danger" {
  if (status === "PAID") return "success";
  if (status === "PARTIAL") return "warning";
  return "danger";
}

function paymentChipClass(status: ReceiptPaymentStatus): string {
  const base =
    "h-5 px-2 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset";
  if (status === "PAID") return `${base} bg-emerald-50 text-emerald-700 ring-emerald-200`;
  if (status === "PARTIAL") return `${base} bg-amber-50 text-amber-700 ring-amber-200`;
  return `${base} bg-rose-50 text-rose-700 ring-rose-200`;
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

function initials(name: string): string {
  const clean = name.trim();
  if (!clean) return "—";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
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
            <span className="inline-flex items-center gap-1.5 rounded-md bg-gulio-bg px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gulio-text ring-1 ring-gulio-border">
              <ReceiptText className="h-3 w-3 text-gulio-muted" aria-hidden />
              {receipt.invoiceNumber ?? receipt.id.slice(0, 8).toUpperCase()}
            </span>
            {receipt.status !== "POSTED" ? (
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
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

      case "distributor": {
        const name = receipt.supplierName ?? "—";
        return (
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-600 ring-1 ring-slate-200"
            >
              {initials(name)}
            </span>
            <span className="truncate text-xs font-medium text-gulio-text">{name}</span>
          </div>
        );
      }

      case "product":
        return (
          <div className="min-w-0">
            {receipt.lines.map((line) => (
              <div key={line.id} className={`${LINE_ROW} min-w-0 gap-2.5`}>
                <ProductThumb imageUrl={line.imageUrl} name={line.productName} />
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold leading-tight text-gulio-text">
                    {line.productName}
                  </p>
                  <p className="truncate text-[10.5px] leading-tight text-gulio-muted">
                    {line.variantName}
                    {line.sku ? ` · ${line.sku}` : ""}
                    {line.tracksSerial ? " · IMEI" : ""}
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
                className={`${LINE_ROW} justify-end text-xs tabular-nums text-gulio-muted`}
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
          <span className="text-[13px] font-bold tabular-nums text-gulio-text">
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
        const settled = pending <= 0;
        return (
          <span
            className={`text-xs font-semibold tabular-nums ${
              settled ? "text-gulio-muted" : "text-amber-700"
            }`}
          >
            {settled ? "—" : formatMoney(receipt.pendingTotal)}
          </span>
        );
      }

      case "status":
        return (
          <div className="flex flex-col items-center gap-1">
            <Chip
              size="sm"
              variant="flat"
              className={paymentChipClass(receipt.paymentStatus)}
            >
              {receipt.paymentStatus}
            </Chip>
            {receipt.status === "DRAFT" ? (
              <span className="rounded bg-slate-100 px-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-inset ring-slate-200">
                Draft
              </span>
            ) : null}
            {receipt.status === "CANCELLED" ? (
              <span className="rounded bg-rose-50 px-1.5 text-[9px] font-bold uppercase tracking-wide text-rose-700 ring-1 ring-inset ring-rose-200">
                Cancelled
              </span>
            ) : null}
          </div>
        );

      case "open":
        return (
          <ChevronRight
            aria-hidden
            className="ml-auto h-4 w-4 text-gulio-muted opacity-0 transition group-hover:opacity-100"
          />
        );

      default:
        return null;
    }
  }

  if (error) {
    return (
      <div className="p-4 sm:p-5">
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
      </div>
    );
  }

  return (
    <div aria-label="Receipt history" role="region">
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
          thead: "[&>tr]:bg-gulio-bg/70",
          th: "h-10 border-b border-gulio-border bg-transparent px-3 text-[10px] font-bold uppercase tracking-wider text-gulio-muted",
          td: "border-b border-gulio-border/60",
          tr: "group cursor-pointer transition-colors hover:bg-teal-50/40 data-[selected=true]:bg-teal-50/60",
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
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                  <Skeleton className="h-4 flex-1 rounded-md" />
                  <Skeleton className="hidden h-4 w-24 rounded-md sm:block" />
                  <Skeleton className="hidden h-4 w-20 rounded-md md:block" />
                </div>
              ))}
            </div>
          }
          emptyContent={
            <div className="p-4 sm:p-5">
              <EmptyState
                icon={<PackageSearch className="h-6 w-6" aria-hidden />}
                title="No receipts match"
                description="Adjust the search or filters above, or post a new goods receipt to move stock into the ledger."
              />
            </div>
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
                    className={`px-3 py-2.5 ${isLine ? "align-top" : "align-middle"} ${
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

      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gulio-border bg-gulio-bg/40 px-4 py-2.5 sm:px-5">
          <p className="text-xs text-gulio-muted">
            <span className="font-semibold tabular-nums text-gulio-text">
              {total}
            </span>{" "}
            receipt{total === 1 ? "" : "s"} · {rangeLabel} · click a row to open it
          </p>
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
