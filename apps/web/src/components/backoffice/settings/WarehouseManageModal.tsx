"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import {
  Warehouse as WarehouseIcon,
  Building2,
  Trash2,
  ArrowRightLeft,
  Check,
  AlertTriangle,
} from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";

export type ManageWarehouseData = {
  id: string;
  name: string;
  branchId: string;
  isDefault: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  warehouse: ManageWarehouseData | null;
  allBranches: Array<{ id: string; name: string; code: string; isActive?: boolean }>;
  initialDeleteMode?: boolean;
};

const inputClass =
  "w-full rounded-xl border border-gulio-border bg-white px-3.5 py-2.5 text-sm text-gulio-text outline-none transition placeholder:text-gulio-muted/50 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

const labelClass =
  "mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-gulio-muted";

export function WarehouseManageModal({
  isOpen,
  onClose,
  onSaved,
  warehouse,
  allBranches,
  initialDeleteMode = false,
}: Props) {
  const { refreshOrgContext } = useAuth();
  const [name, setName] = useState("");
  const [targetBranchId, setTargetBranchId] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isOpen || !warehouse) return;
    setName(warehouse.name);
    setTargetBranchId(warehouse.branchId);
    setIsDefault(warehouse.isDefault);
    setError(null);
    setConfirmDelete(initialDeleteMode);
    setSaving(false);
  }, [isOpen, warehouse, initialDeleteMode]);

  if (!warehouse) return null;

  const currentBranch = allBranches.find((b) => b.id === warehouse.branchId);

  async function handleSave() {
    if (!warehouse) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Warehouse name cannot be empty");
      return;
    }
    if (!targetBranchId) {
      setError("Please select a valid branch to assign this warehouse to");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiFetch(`/organization/warehouses/${encodeURIComponent(warehouse.id)}`, {
        method: "PATCH",
        body: {
          name: trimmed,
          branchId: targetBranchId,
          isDefault,
        },
      });

      await refreshOrgContext();
      window.dispatchEvent(new Event("gulio_branch_change"));
      onSaved();
      onClose();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not update warehouse",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteOrDeassign() {
    if (!warehouse) return;
    setSaving(true);
    setError(null);

    try {
      await apiFetch(`/organization/warehouses/${encodeURIComponent(warehouse.id)}`, {
        method: "DELETE",
      });

      await refreshOrgContext();
      window.dispatchEvent(new Event("gulio_branch_change"));
      onSaved();
      onClose();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not remove warehouse",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      backdrop="blur"
      placement="center"
      classNames={{
        base: "border border-gulio-border bg-white shadow-2xl rounded-3xl overflow-hidden",
        header: "border-b border-gulio-border/60 bg-gradient-to-r from-slate-50 via-teal-50/30 to-slate-50 px-6 py-4",
        footer: "border-t border-gulio-border/60 bg-slate-50/70 px-6 py-3.5",
      }}
    >
      <ModalContent>
        <ModalHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500 text-white shadow-md shadow-teal-500/20">
              <WarehouseIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-slate-900">
                Manage Warehouse
              </h3>
              <p className="text-xs text-gulio-muted">
                Edit name, assign to a different branch, or de-assign this warehouse
              </p>
            </div>
          </div>
        </ModalHeader>

        <ModalBody className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {error}
            </div>
          )}

          {/* Warehouse Name */}
          <div>
            <label className={labelClass}>Warehouse Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main Stock Storage, Branch Overflow..."
              className={inputClass}
            />
          </div>

          {/* Assigned Branch Selector */}
          <div>
            <label className={labelClass}>
              <span>Assigned Branch Location</span>
              {currentBranch && (
                <span className="font-normal text-slate-400 lowercase">
                  currently: <strong className="text-slate-700">{currentBranch.name}</strong>
                </span>
              )}
            </label>
            <div className="relative">
              <select
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className={`${inputClass} appearance-none pr-10`}
              >
                {allBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code}) {b.id === warehouse.branchId ? "— (Current)" : ""}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <ArrowRightLeft className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Changing this branch will re-assign this warehouse and its live stock to the selected branch.
            </p>
          </div>

          {/* Default Warehouse Toggle */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <div>
                <span className="block text-xs font-bold text-slate-800">
                  Primary / Default Warehouse for this Branch
                </span>
                <span className="block text-[11px] text-slate-500">
                  Used as the automatic destination for POS sales deductions and new purchase intakes.
                </span>
              </div>
            </label>
          </div>

          {/* Danger Zone: De-assign / Remove */}
          <div className="rounded-2xl border border-red-100 bg-red-50/50 p-4">
            {!confirmDelete ? (
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-xs font-bold text-red-950">
                    De-assign or Remove Warehouse
                  </span>
                  <span className="block text-[11px] text-red-700/80">
                    Detach this warehouse from the branch or delete it.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="flat"
                  color="danger"
                  onPress={() => setConfirmDelete(true)}
                  className="text-xs font-semibold"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  De-assign / Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-xs font-bold text-red-950">
                      Confirm De-assignment of &ldquo;{warehouse.name}&rdquo;?
                    </span>
                    <span className="block text-[11px] text-red-700 leading-relaxed">
                      This will remove this warehouse from {currentBranch?.name ?? "its branch"}.
                      If this is the only default warehouse, ensure you have another warehouse assigned.
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="bordered"
                    onPress={() => setConfirmDelete(false)}
                    className="text-xs font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    isLoading={saving}
                    onPress={handleDeleteOrDeassign}
                    className="text-xs font-bold shadow-sm"
                  >
                    Yes, De-assign / Remove
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ModalBody>

        <ModalFooter className="flex items-center justify-between">
          <Button
            variant="flat"
            onPress={onClose}
            className="text-xs font-semibold text-slate-600"
          >
            Cancel
          </Button>

          <Button
            color="primary"
            isLoading={saving}
            onPress={handleSave}
            className="flex items-center gap-2 rounded-xl bg-teal-600 font-bold text-white shadow-md shadow-teal-600/20 hover:bg-teal-700 text-xs px-5"
          >
            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
            Save Changes & Reassign
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
