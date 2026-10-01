"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  AutocompleteItem,
  Spinner,
} from "@heroui/react";
import { Store } from "lucide-react";
import { Field } from "./Field";

export type SupplierOption = { id: string; name: string };

type Props = {
  suppliers: SupplierOption[];
  /** Selected supplier id, or null when free text / none. */
  value: string | null;
  /** Selected supplier name for display. */
  valueName: string | null;
  disabled?: boolean;
  loading?: boolean;
  onChange: (next: { id: string | null; name: string | null }) => void;
  /** Tracks raw typed text so the page can fall back to a free-text name. */
  onInputValueChange?: (value: string) => void;
  /** Creates a distributor from a typed name; returns the new option. */
  onCreate: (name: string) => Promise<SupplierOption | null>;
};

const inputClassNames = {
  label: "text-[10px] font-semibold uppercase tracking-wider text-gulio-muted",
  inputWrapper:
    "min-h-9 rounded-lg border border-gulio-border bg-white shadow-none data-[hover=true]:border-slate-300 group-data-[focus=true]:border-teal-500",
  input: "text-sm text-gulio-text",
} as const;

/**
 * Searchable distributor picker. Typing a name that is not in the list and
 * pressing Enter creates it inline via `POST /purchasing/suppliers`, then
 * selects the new supplier id. Selecting nothing leaves the receipt on the
 * free-text `supplierName` path.
 */
export function SupplierCombobox({
  suppliers,
  value,
  valueName,
  disabled = false,
  loading = false,
  onChange,
  onInputValueChange,
  onCreate,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [inputValue, setInputValue] = useState(valueName ?? "");

  const items = useMemo(
    () => suppliers.map((s) => ({ key: s.id, label: s.name })),
    [suppliers],
  );

  // Keep the visible text in step with the selected supplier (e.g. after the
  // parent clears the form once a receipt is posted).
  useEffect(() => {
    if (value == null) {
      setInputValue("");
      return;
    }
    if (valueName) setInputValue(valueName);
  }, [value, valueName]);

  async function handleSelection(key: string | null) {
    if (key === null) {
      onChange({ id: null, name: null });
      setInputValue("");
      return;
    }
    const existing = suppliers.find((s) => s.id === key);
    if (existing) {
      onChange({ id: existing.id, name: existing.name });
      setInputValue(existing.name);
      return;
    }

    // Custom typed value — create the distributor inline.
    const name = key.trim();
    if (name.length < 2) {
      onChange({ id: null, name: null });
      setInputValue("");
      return;
    }
    setCreating(true);
    try {
      const created = await onCreate(name);
      if (created) {
        onChange({ id: created.id, name: created.name });
        setInputValue(created.name);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <Field label="Distributor / supplier" hint="Type a name and press Enter to create one.">
      <Autocomplete
        size="sm"
        aria-label="Distributor / supplier"
        placeholder="Search or type a new distributor…"
        allowsCustomValue
        isDisabled={disabled || creating}
        isLoading={loading}
        items={items}
        selectedKey={value}
        inputValue={inputValue}
        onInputChange={(next) => {
          setInputValue(next);
          onInputValueChange?.(next);
        }}
        onSelectionChange={(key) => {
          void handleSelection(key == null ? null : String(key));
        }}
        startContent={
          creating ? (
            <Spinner size="sm" color="current" />
          ) : (
            <Store size={15} className="text-gulio-muted" aria-hidden />
          )
        }
        classNames={{
          ...inputClassNames,
          popoverContent: "rounded-xl border border-gulio-border",
        }}
      >
        {(item) => <AutocompleteItem key={item.key}>{item.label}</AutocompleteItem>}
      </Autocomplete>
    </Field>
  );
}
