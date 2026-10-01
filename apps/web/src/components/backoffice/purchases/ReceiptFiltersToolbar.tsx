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
import {
  CalendarRange,
  Check,
  CreditCard,
  History,
  MapPin,
  ReceiptText,
  Search,
  SlidersHorizontal,
  Store,
  Truck,
  X,
} from "lucide-react";
import { Field, fieldClassNames, selectClassNames } from "./Field";
import { RECEIPT_COLUMNS, type ReceiptColumnKey } from "./receipt-columns";

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

const ALL = "__all";

function toSelectKey(value: string): string {
  return value === "" ? ALL : value;
}

function fromSelectKey(key: string): string {
  return key === ALL ? "" : key;
}

function FilterSelect({
  ariaLabel,
  placeholder,
  value,
  options,
  onChange,
}: {
  ariaLabel: string;
  placeholder: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      size="sm"
      aria-label={ariaLabel}
      placeholder={placeholder}
      selectedKeys={new Set([toSelectKey(value)])}
      onSelectionChange={(keys) => {
        if (keys === "all") return;
        const first = Array.from(keys)[0];
        onChange(first == null ? "" : fromSelectKey(String(first)));
      }}
      classNames={selectClassNames}
      renderValue={(items) =>
        items.map((item) => (
          <span key={item.key} className="truncate">
            {item.textValue ?? placeholder}
          </span>
        ))
      }
    >
      {options.map((o) => (
        <SelectItem key={o.value} textValue={o.label}>
          {o.label}
        </SelectItem>
      ))}
    </Select>
  );
}

/** One removable chip describing an applied filter. */
type ActiveChip = { key: keyof ReceiptFilterState; label: string; icon: React.ReactNode };

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
  const customizableColumns = useMemo(
    () => RECEIPT_COLUMNS.filter((c) => !c.hidden),
    [],
  );
  const visibleColumnCount = customizableColumns.filter(
    (c) => c.locked || visibleSet.has(c.key),
  ).length;

  const supplierOptions: Option[] = useMemo(
    () => [{ value: ALL, label: "All distributors" }, ...suppliers],
    [suppliers],
  );
  const branchOptions: Option[] = useMemo(
    () => [{ value: ALL, label: "All branches" }, ...branches],
    [branches],
  );
  const warehouseOptions: Option[] = useMemo(
    () => [{ value: ALL, label: "All warehouses" }, ...warehouses],
    [warehouses],
  );
  const statusOptions: Option[] = useMemo(
    () => [{ value: ALL, label: "Any status" }, ...STATUS_OPTIONS],
    [],
  );
  const paymentOptions: Option[] = useMemo(
    () => [{ value: ALL, label: "Any payment" }, ...PAYMENT_OPTIONS],
    [],
  );

  const labelFor = (options: Option[], id: string): string =>
    options.find((o) => o.value === id)?.label ?? id;

  const chips = useMemo<ActiveChip[]>(() => {
    const out: ActiveChip[] = [];
    if (value.search.trim()) {
      out.push({
        key: "search",
        label: `“${value.search.trim()}”`,
        icon: <Search className="h-3 w-3" aria-hidden />,
      });
    }
    if (value.supplierId) {
      out.push({
        key: "supplierId",
        label: labelFor(suppliers, value.supplierId),
        icon: <Truck className="h-3 w-3" aria-hidden />,
      });
    }
    if (value.branchId) {
      out.push({
        key: "branchId",
        label: labelFor(branches, value.branchId),
        icon: <Store className="h-3 w-3" aria-hidden />,
      });
    }
    if (value.warehouseId) {
      out.push({
        key: "warehouseId",
        label: labelFor(warehouses, value.warehouseId),
        icon: <MapPin className="h-3 w-3" aria-hidden />,
      });
    }
    if (value.status) {
      out.push({
        key: "status",
        label: `Status: ${labelFor(STATUS_OPTIONS, value.status)}`,
        icon: <ReceiptText className="h-3 w-3" aria-hidden />,
      });
    }
    if (value.paymentStatus) {
      out.push({
        key: "paymentStatus",
        label: `Payment: ${labelFor(PAYMENT_OPTIONS, value.paymentStatus)}`,
        icon: <CreditCard className="h-3 w-3" aria-hidden />,
      });
    }
    if (value.from || value.to) {
      out.push({
        key: "from",
        label: `${value.from || "…"} → ${value.to || "…"}`,
        icon: <CalendarRange className="h-3 w-3" aria-hidden />,
      });
    }
    return out;
  }, [value, suppliers, branches, warehouses]);

  function removeChip(chip: ActiveChip) {
    if (chip.key === "from") {
      onChange({ from: "", to: "" });
      return;
    }
    onChange({ [chip.key]: "" } as Partial<ReceiptFilterState>);
  }

  return (
    <section aria-label="Receipt filters" className="border-b border-gulio-border">
      {/* ------------------------------- header ------------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-200">
            <History className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-gulio-text">
                Receipt history
              </h2>
              {loading ? (
                <Spinner size="sm" color="primary" aria-label="Loading receipts" />
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-gulio-muted">
              Every goods receipt posted to the ledger — with what is still owed to
              each distributor.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-gulio-muted transition hover:bg-gulio-bg hover:text-gulio-text"
            >
              <X size={14} aria-hidden />
              Clear filters
            </button>
          ) : null}

          <Popover placement="bottom-end" showArrow offset={8}>
            <PopoverTrigger>
              <Button
                size="sm"
                variant="bordered"
                radius="md"
                startContent={<SlidersHorizontal size={15} aria-hidden />}
                className="min-h-9 border-slate-200 bg-white text-xs font-semibold text-gulio-text shadow-none"
              >
                Columns
                <span className="ml-1 rounded bg-gulio-bg px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-gulio-muted">
                  {visibleColumnCount}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[290px] p-4">
              <div className="flex w-full items-center justify-between gap-2">
                <p className="text-sm font-bold text-gulio-text">
                  Table columns
                </p>
                <button
                  type="button"
                  onClick={onResetColumns}
                  className="text-[11px] font-semibold text-teal-700 hover:underline"
                >
                  Reset
                </button>
              </div>
              <p className="mt-0.5 text-xs text-gulio-muted">
                Pick what the receipt table shows. Invoice, product and status stay
                pinned.
              </p>
              <ul className="mt-3 max-h-72 w-full space-y-1.5 overflow-y-auto pr-1">
                {customizableColumns.map((column) => {
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
                        classNames={{ label: "text-sm text-gulio-text" }}
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

      {/* ------------------------------ controls ------------------------------ */}
      <div className="bg-gulio-bg/40 px-4 pb-3.5 pt-3.5 sm:px-5">
        <Field label="Search receipts">
          <Input
            size="sm"
            aria-label="Search receipts"
            placeholder="Invoice number, distributor, product or SKU…"
            value={value.search}
            onValueChange={(next) => onChange({ search: next })}
            isClearable
            startContent={
              <Search size={15} className="shrink-0 text-gulio-muted" aria-hidden />
            }
            endContent={loading ? <Spinner size="sm" color="current" /> : undefined}
            classNames={{
              ...fieldClassNames,
              inputWrapper: `${fieldClassNames.inputWrapper} px-3`,
            }}
          />
        </Field>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Field label="Distributor">
            <FilterSelect
              ariaLabel="Filter by distributor"
              placeholder="Any distributor"
              value={value.supplierId}
              options={supplierOptions}
              onChange={(next) => onChange({ supplierId: next })}
            />
          </Field>

          <Field label="Branch">
            <FilterSelect
              ariaLabel="Filter by branch"
              placeholder="All branches"
              value={value.branchId}
              options={branchOptions}
              onChange={(next) => onChange({ branchId: next, warehouseId: "" })}
            />
          </Field>

          <Field label="Warehouse">
            <FilterSelect
              ariaLabel="Filter by warehouse"
              placeholder="All warehouses"
              value={value.warehouseId}
              options={warehouseOptions}
              onChange={(next) => onChange({ warehouseId: next })}
            />
          </Field>

          <Field label="Status">
            <FilterSelect
              ariaLabel="Filter by receipt status"
              placeholder="Any status"
              value={value.status}
              options={statusOptions}
              onChange={(next) => onChange({ status: next })}
            />
          </Field>

          <Field label="Payment status">
            <FilterSelect
              ariaLabel="Filter by payment status"
              placeholder="Any payment"
              value={value.paymentStatus}
              options={paymentOptions}
              onChange={(next) => onChange({ paymentStatus: next })}
            />
          </Field>

          <Field label="Received from">
            <Input
              size="sm"
              type="date"
              aria-label="Received from"
              value={value.from}
              max={value.to || undefined}
              onValueChange={(next) => onChange({ from: next })}
              classNames={fieldClassNames}
            />
          </Field>

          <Field label="Received to">
            <Input
              size="sm"
              type="date"
              aria-label="Received to"
              value={value.to}
              min={value.from || undefined}
              onValueChange={(next) => onChange({ to: next })}
              classNames={fieldClassNames}
            />
          </Field>
        </div>

        {/* --------------------------- applied filters --------------------------- */}
        {chips.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-gulio-border/70 pt-3">
            <span className="mr-0.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gulio-muted">
              <Check className="h-3 w-3" aria-hidden />
              Applied
            </span>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => removeChip(chip)}
                className="group inline-flex max-w-[240px] items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 py-1 pl-2 pr-1.5 text-[11px] font-semibold text-teal-800 transition hover:border-teal-300 hover:bg-teal-100"
              >
                <span className="shrink-0 text-teal-600">{chip.icon}</span>
                <span className="truncate">{chip.label}</span>
                <X
                  className="h-3 w-3 shrink-0 text-teal-600 transition group-hover:text-teal-900"
                  aria-hidden
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
