"use client";

import { useMemo } from "react";
import {
  Button,
  Checkbox,
  Chip,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectItem,
  Spinner,
} from "@heroui/react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  RECEIPT_COLUMNS,
  type ReceiptColumnKey,
} from "./receipt-columns";

export type ReceiptFilterState = {
  search: string;
  supplierId: string;
  branchId: string;
  warehouseId: string;
  status: string;
  paymentStatus: string;
  from: string;
  to: string;
};

export const EMPTY_RECEIPT_FILTERS: ReceiptFilterState = {
  search: "",
  supplierId: "",
  branchId: "",
  warehouseId: "",
  status: "",
  paymentStatus: "",
  from: "",
  to: "",
};

export type Option = { value: string; label: string };

type Props = {
  value: ReceiptFilterState;
  onChange: (patch: Partial<ReceiptFilterState>) => void;
  onReset: () => void;
  loading: boolean;
  activeCount: number;
  suppliers: Option[];
  branches: Option[];
  warehouses: Option[];
  visibleColumns: ReceiptColumnKey[];
  onToggleColumn: (key: ReceiptColumnKey, visible: boolean) => void;
  onResetColumns: () => void;
};

const STATUS_OPTIONS: Option[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "POSTED", label: "Posted" },
  { value: "CANCELLED", label: "Cancelled" },
];

const PAYMENT_OPTIONS: Option[] = [
  { value: "PAID", label: "Paid" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PENDING", label: "Pending" },
];

function toSelectKey(value: string): string {
  return value === "" ? "__all" : value;
}

function fromSelectKey(key: string): string {
  return key === "__all" ? "" : key;
}

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      size="sm"
      label={label}
      placeholder={placeholder}
      selectedKeys={new Set([toSelectKey(value)])}
      onSelectionChange={(keys) => {
        if (keys === "all") return;
        const first = Array.from(keys)[0];
        onChange(first == null ? "" : fromSelectKey(String(first)));
      }}
      classNames={{
        label:
          "text-[10px] font-semibold uppercase tracking-wider text-gulio-muted",
        trigger:
          "min-h-9 rounded-lg border border-gulio-border bg-white shadow-none data-[hover=true]:border-slate-300",
        value: "text-sm text-gulio-text",
        popoverContent: "rounded-xl border border-gulio-border",
      }}
    >
      {options.map((o) => (
        <SelectItem key={o.value}>{o.label}</SelectItem>
      ))}
    </Select>
  );
}

const dateInputClass = {
  label: "text-[10px] font-semibold uppercase tracking-wider text-gulio-muted",
  inputWrapper:
    "min-h-9 rounded-lg border border-gulio-border bg-white shadow-none data-[hover=true]:border-slate-300 group-data-[focus=true]:border-teal-500",
  input: "text-sm text-gulio-text",
} as const;

export function ReceiptFiltersToolbar({
  value,
  onChange,
  onReset,
  loading,
  activeCount,
  suppliers,
  branches,
  warehouses,
  visibleColumns,
  onToggleColumn,
  onResetColumns,
}: Props) {
  const visibleSet = useMemo(() => new Set(visibleColumns), [visibleColumns]);
  const optionalColumns = useMemo(
    () => RECEIPT_COLUMNS.filter((c) => !c.locked),
    [],
  );

  const supplierOptions: Option[] = useMemo(
    () => [{ value: "__all", label: "All distributors" }, ...suppliers],
    [suppliers],
  );
  const branchOptions: Option[] = useMemo(
    () => [{ value: "__all", label: "All branches" }, ...branches],
    [branches],
  );
  const warehouseOptions: Option[] = useMemo(
    () => [{ value: "__all", label: "All warehouses" }, ...warehouses],
    [warehouses],
  );
  const statusOptions: Option[] = useMemo(
    () => [{ value: "__all", label: "Any status" }, ...STATUS_OPTIONS],
    []);
  const paymentOptions: Option[] = useMemo(
    () => [{ value: "__all", label: "Any payment" }, ...PAYMENT_OPTIONS],
    [],
  );

  return (
    <section
      aria-label="Receipt filters"
      className="rounded-xl border border-gulio-border bg-gulio-card p-3 shadow-sm sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold tracking-tight text-gulio-text">
            Receipt history
          </h2>
          {activeCount > 0 ? (
            <Chip
              size="sm"
              variant="flat"
              color="primary"
              className="h-5 px-2 text-[10px] font-bold tabular-nums"
            >
              {activeCount} active
            </Chip>
          ) : null}
          {loading ? (
            <Spinner size="sm" color="primary" aria-label="Loading receipts" />
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-gulio-muted transition hover:bg-gulio-bg hover:text-gulio-text"
            >
              <X size={14} aria-hidden />
              Clear filters
            </button>
          ) : null}

          <Popover placement="bottom-end" showArrow>
            <PopoverTrigger>
              <Button
                size="sm"
                variant="bordered"
                radius="md"
                startContent={<SlidersHorizontal size={15} aria-hidden />}
                className="min-h-8 border-slate-200 bg-white text-xs font-semibold text-gulio-text"
              >
                Customize
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-4">
              <div className="flex w-full items-center justify-between gap-2">
                <p className="text-sm font-bold text-gulio-text">Columns</p>
                <button
                  type="button"
                  onClick={onResetColumns}
                  className="text-[11px] font-semibold text-teal-700 hover:underline"
                >
                  Reset columns
                </button>
              </div>
              <p className="mt-0.5 text-xs text-gulio-muted">
                Pick the columns shown in the receipt table. Invoice, product
                and status stay pinned.
              </p>
              <ul className="mt-3 max-h-72 w-full space-y-1.5 overflow-y-auto pr-1">
                {RECEIPT_COLUMNS.map((column) => {
                  const locked = Boolean(column.locked);
                  return (
                    <li key={column.key}>
                      <Checkbox
                        size="sm"
                        isSelected={locked || visibleSet.has(column.key)}
                        isDisabled={locked}
                        onValueChange={(next) => {
                          if (locked) return;
                          onToggleColumn(column.key, next);
                        }}
                        classNames={{
                          label: "text-sm text-gulio-text",
                        }}
                      >
                        {column.label}
                        {locked ? (
                          <span className="ml-1 text-[10px] font-semibold uppercase text-gulio-muted">
                            pinned
                          </span>
                        ) : null}
                      </Checkbox>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 w-full border-t border-gulio-border pt-3">
                <button
                  type="button"
                  onClick={onReset}
                  disabled={activeCount === 0}
                  className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-gulio-text transition hover:bg-gulio-bg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={14} aria-hidden />
                  Clear all filters
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input
          size="sm"
          label="Search"
          placeholder="Invoice, distributor, product, SKU…"
          value={value.search}
          onValueChange={(next) => onChange({ search: next })}
          isClearable
          startContent={<Search size={15} className="text-gulio-muted" aria-hidden />}
          endContent={loading ? <Spinner size="sm" color="current" /> : undefined}
          classNames={{
            label:
              "text-[10px] font-semibold uppercase tracking-wider text-gulio-muted",
            inputWrapper:
              "min-h-9 rounded-lg border border-gulio-border bg-white shadow-none data-[hover=true]:border-slate-300 group-data-[focus=true]:border-teal-500",
            input: "text-sm text-gulio-text",
          }}
          className="xl:col-span-1"
        />

        <FilterSelect
          label="Distributor"
          placeholder="Any distributor"
          value={value.supplierId}
          options={supplierOptions}
          onChange={(next) => onChange({ supplierId: next })}
        />

        <FilterSelect
          label="Branch"
          placeholder="All branches"
          value={value.branchId}
          options={branchOptions}
          onChange={(next) => onChange({ branchId: next, warehouseId: "" })}
        />

        <FilterSelect
          label="Warehouse"
          placeholder="All warehouses"
          value={value.warehouseId}
          options={warehouseOptions}
          onChange={(next) => onChange({ warehouseId: next })}
        />

        <FilterSelect
          label="Status"
          placeholder="Any status"
          value={value.status}
          options={statusOptions}
          onChange={(next) => onChange({ status: next })}
        />

        <FilterSelect
          label="Payment status"
          placeholder="Any payment"
          value={value.paymentStatus}
          options={paymentOptions}
          onChange={(next) => onChange({ paymentStatus: next })}
        />

        <Input
          size="sm"
          type="date"
          label="Received from"
          value={value.from}
          max={value.to || undefined}
          onValueChange={(next) => onChange({ from: next })}
          classNames={dateInputClass}
        />

        <Input
          size="sm"
          type="date"
          label="Received to"
          value={value.to}
          min={value.from || undefined}
          onValueChange={(next) => onChange({ to: next })}
          classNames={dateInputClass}
        />
      </div>
    </section>
  );
}
