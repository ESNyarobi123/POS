"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import {
  Building2,
  Warehouse as WarehouseIcon,
  MapPin,
  Phone,
} from "lucide-react";
import type {
  BranchDetailDto,
  CreateBranchRequest,
  CreateWarehouseRequest,
} from "@gulio/contracts";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialBranchId?: string | null;
  mode?: "branch" | "warehouse";
};

const inputClass =
  "w-full rounded-xl border border-gulio-border bg-white px-3.5 py-2.5 text-sm text-gulio-text outline-none transition placeholder:text-gulio-muted/50 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

const labelClass =
  "mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-gulio-muted";

function getNextBranchCode(existingBranches: Array<{ code?: string }>): string {
  let maxNum = 0;
  for (const b of existingBranches) {
    const match = (b.code ?? "").toUpperCase().match(/^BGS(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const nextNum = maxNum + 1;
  return `BGS${String(nextNum).padStart(4, "0")}`;
}

export function BranchFormModal({
  isOpen,
  onClose,
  onSaved,
  initialBranchId,
  mode = "branch",
}: Props) {
  const { orgContext, refreshOrgContext } = useAuth();
  const allBranches = useMemo(() => orgContext?.branches ?? [], [orgContext?.branches]);

  const [activeTab, setActiveTab] = useState<"branch" | "warehouse">(mode);

  // Branch form fields
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Warehouse form fields
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [extraWarehouseName, setExtraWarehouseName] = useState("");
  const [isDefaultWarehouse, setIsDefaultWarehouse] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form state
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(mode);
    setError(null);
    setSaving(false);

    if (initialBranchId) {
      setSelectedBranchId(initialBranchId);
    } else if (allBranches.length > 0) {
      setSelectedBranchId(allBranches[0].id);
    } else {
      setSelectedBranchId("");
    }

    // Generate BGS0001, BGS0002 pattern
    const nextCode = getNextBranchCode(allBranches);
    setBranchCode(nextCode);

    setBranchName("");
    setLocation("");
    setPhone("");
    setWarehouseName("");
    setIsActive(true);
    setExtraWarehouseName("");
    setIsDefaultWarehouse(false);
  }, [isOpen, mode, initialBranchId, allBranches]);

  function handleBranchNameChange(val: string) {
    setBranchName(val);
    if (
      !warehouseName ||
      warehouseName.endsWith("Main Warehouse") ||
      warehouseName.endsWith("Default")
    ) {
      setWarehouseName(val.trim() ? `${val.trim()} Main Warehouse` : "");
    }
  }

  async function handleSubmit() {
    setError(null);
    setSaving(true);

    try {
      if (activeTab === "branch") {
        const name = branchName.trim();
        const code = branchCode.trim().toUpperCase();

        if (!name) {
          setError("Branch name is required");
          setSaving(false);
          return;
        }
        if (!code) {
          setError("Branch code is required");
          setSaving(false);
          return;
        }

        const body: CreateBranchRequest = {
          name,
          code,
          initialWarehouseName:
            warehouseName.trim() || `${name} Main Warehouse`,
          isActive,
        };

        await apiFetch<BranchDetailDto>("/organization/branches", {
          method: "POST",
          body,
        });

        await refreshOrgContext();
        onSaved();
        onClose();
      } else {
        // Warehouse Tab
        const name = extraWarehouseName.trim();
        if (!name) {
          setError("Warehouse name is required");
          setSaving(false);
          return;
        }
        if (!selectedBranchId) {
          setError("Please select a parent branch");
          setSaving(false);
          return;
        }

        const body: CreateWarehouseRequest = {
          branchId: selectedBranchId,
          name,
          isDefault: isDefaultWarehouse,
        };

        await apiFetch("/organization/warehouses", {
          method: "POST",
          body,
        });

        await refreshOrgContext();
        onSaved();
        onClose();
      }
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not save. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      scrollBehavior="inside"
      classNames={{
        base: "border border-gulio-border bg-white text-gulio-text shadow-2xl rounded-2xl max-w-lg",
        header: "border-b border-gulio-border/70 pb-3 pt-4 px-5",
        body: "py-4 px-5",
        footer: "border-t border-gulio-border/70 py-3 px-5 bg-slate-50/70 rounded-b-2xl",
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 ring-1 ring-teal-200">
                  {activeTab === "branch" ? (
                    <Building2 className="h-4 w-4" />
                  ) : (
                    <WarehouseIcon className="h-4 w-4" />
                  )}
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {activeTab === "branch" ? "New Branch" : "New Warehouse"}
                </h3>
              </div>

              {/* Tab Selector */}
              <div className="flex rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("branch")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition ${
                    activeTab === "branch"
                      ? "bg-white text-teal-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Branch Store
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("warehouse")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition ${
                    activeTab === "warehouse"
                      ? "bg-white text-teal-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <WarehouseIcon className="h-3.5 w-3.5" />
                  Additional Warehouse
                </button>
              </div>
            </ModalHeader>

            <ModalBody className="space-y-3.5">
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                  {error}
                </div>
              ) : null}

              {activeTab === "branch" ? (
                <div className="space-y-3.5">
                  <div>
                    <label className={labelClass}>
                      <span>Branch Name</span>
                      <span className="text-[11px] font-normal text-teal-600">
                        Required *
                      </span>
                    </label>
                    <input
                      value={branchName}
                      onChange={(e) => handleBranchNameChange(e.target.value)}
                      placeholder="e.g. Kariakoo Flagship Store"
                      className={inputClass}
                      autoFocus
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>
                        <span>Branch Code</span>
                        <span className="text-[11px] font-normal text-teal-600">
                          Auto (BGS...)
                        </span>
                      </label>
                      <input
                        value={branchCode}
                        onChange={(e) =>
                          setBranchCode(e.target.value.toUpperCase())
                        }
                        placeholder="e.g. BGS0001"
                        className={`${inputClass} font-mono font-semibold tracking-wider text-teal-900 bg-teal-50/20 border-teal-200/80 focus:bg-white`}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>
                        <span>Phone / Contact</span>
                        <span className="text-[11px] font-normal text-slate-400">
                          Optional
                        </span>
                      </label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+255 7XX XXX XXX"
                          className={`${inputClass} pl-9`}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>
                      <span>Street Address / City</span>
                      <span className="text-[11px] font-normal text-slate-400">
                        Optional
                      </span>
                    </label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Msimbazi Street, Dar es Salaam"
                        className={`${inputClass} pl-9`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>
                      <span>Primary Warehouse</span>
                      <span className="text-[11px] font-normal text-teal-600">
                        Auto-assigned
                      </span>
                    </label>
                    <input
                      value={warehouseName}
                      onChange={(e) => setWarehouseName(e.target.value)}
                      placeholder="e.g. Kariakoo Main Warehouse"
                      className={inputClass}
                    />
                  </div>

                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gulio-border px-3.5 py-2.5 transition hover:bg-slate-50">
                    <span className="text-sm font-semibold text-slate-900">
                      Active Branch
                    </span>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                  </label>
                </div>
              ) : (
                /* Warehouse Form */
                <div className="space-y-3.5">
                  <div>
                    <label className={labelClass}>
                      <span>Parent Branch</span>
                      <span className="text-[11px] font-normal text-teal-600">
                        Required *
                      </span>
                    </label>
                    {allBranches.length === 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                        No branches found. Please create a branch first before adding a warehouse.
                      </div>
                    ) : (
                      <select
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        className="w-full rounded-xl border border-gulio-border bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
                      >
                        {!selectedBranchId && (
                          <option value="" disabled>
                            — Select a branch —
                          </option>
                        )}
                        {allBranches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>
                      <span>Warehouse Name</span>
                      <span className="text-[11px] font-normal text-teal-600">
                        Required *
                      </span>
                    </label>
                    <input
                      value={extraWarehouseName}
                      onChange={(e) => setExtraWarehouseName(e.target.value)}
                      placeholder="e.g. Backroom Storage, Repairs Room"
                      className={inputClass}
                      autoFocus
                    />
                  </div>

                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gulio-border px-3.5 py-2.5 transition hover:bg-slate-50">
                    <span className="text-sm font-semibold text-slate-900">
                      Default Warehouse for this Branch
                    </span>
                    <input
                      type="checkbox"
                      checked={isDefaultWarehouse}
                      onChange={(e) =>
                        setIsDefaultWarehouse(e.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                  </label>
                </div>
              )}
            </ModalBody>

            <ModalFooter className="flex justify-end gap-2">
              <Button
                variant="bordered"
                onPress={onClose}
                isDisabled={saving}
                className="rounded-xl border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button
                onPress={handleSubmit}
                isLoading={saving}
                className="rounded-xl bg-teal-600 px-5 text-xs font-semibold text-white shadow-sm hover:bg-teal-700"
              >
                {activeTab === "branch" ? "Create Branch" : "Save Warehouse"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
