"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Warehouse as WarehouseIcon,
  Plus,
  Search,
  MapPin,
  MonitorSmartphone,
  Sparkles,
  ShieldCheck,
  Boxes,
  Store,
  Pencil,
  Trash2,
  ArrowRightLeft,
  AlertCircle,
} from "lucide-react";
import { Button } from "@heroui/react";
import { useAuth } from "@/lib/auth-store";
import { isUuid } from "@/lib/api";
import { BranchFormModal } from "./BranchFormModal";
import { WarehouseManageModal, ManageWarehouseData } from "./WarehouseManageModal";

type FilterType = "all" | "active" | "multiple_warehouses";

export function BranchesSettingsSection() {
  const { orgContext, refreshOrgContext } = useAuth();
  const branches = orgContext?.branches ?? [];
  const warehouses = orgContext?.warehouses ?? [];
  const registers = orgContext?.registers ?? [];

  const [, setRefreshTick] = useState(0);

  useEffect(() => {
    function handleStorageOrBranchChange() {
      setRefreshTick((t) => t + 1);
    }
    window.addEventListener("gulio_branch_change", handleStorageOrBranchChange);
    window.addEventListener("storage", handleStorageOrBranchChange);
    return () => {
      window.removeEventListener("gulio_branch_change", handleStorageOrBranchChange);
      window.removeEventListener("storage", handleStorageOrBranchChange);
    };
  }, []);

  // Server is the single source of truth — legacy browser-only branches and
  // warehouses (non-UUID ids like `wh-1759…`) are ignored so they can never be
  // displayed or sent back to the API.
  const allBranches = useMemo(
    () => branches.filter((b) => isUuid(b.id)),
    [branches],
  );

  const allWarehouses = useMemo(
    () =>
      warehouses
        .filter((w) => isUuid(w.id))
        .map((w) => ({
          id: w.id,
          name: w.name,
          branchId: w.branchId,
          isDefault: w.isDefault,
        })),
    [warehouses],
  );

  // Unassigned warehouses (if detached or not matching any branch)
  const unassignedWarehouses = useMemo(() => {
    const branchIds = new Set(allBranches.map((b) => b.id));
    return allWarehouses.filter((w) => !w.branchId || !branchIds.has(w.branchId));
  }, [allWarehouses, allBranches]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"branch" | "warehouse">("branch");
  const [modalTargetBranchId, setModalTargetBranchId] = useState<string | null>(null);

  // Warehouse management modal state
  const [manageWarehouse, setManageWarehouse] = useState<ManageWarehouseData | null>(null);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [manageDeleteMode, setManageDeleteMode] = useState(false);

  function openEditWarehouse(w: { id: string; name: string; branchId: string; isDefault: boolean }) {
    setManageWarehouse(w);
    setManageDeleteMode(false);
    setManageModalOpen(true);
  }

  function openDeleteWarehouse(w: { id: string; name: string; branchId: string; isDefault: boolean }) {
    setManageWarehouse(w);
    setManageDeleteMode(true);
    setManageModalOpen(true);
  }

  // Filtered branches
  const filteredBranches = useMemo(() => {
    return allBranches.filter((b) => {
      const q = search.trim().toLowerCase();
      const branchWarehouses = allWarehouses.filter((w) => w.branchId === b.id);
      const matchesSearch =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        branchWarehouses.some((w) => w.name.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (filter === "active") return b.isActive;
      if (filter === "multiple_warehouses") return branchWarehouses.length > 1;
      return true;
    });
  }, [allBranches, allWarehouses, search, filter]);

  // KPIs
  const totalBranchesCount = allBranches.length;
  const activeBranchesCount = allBranches.filter((b) => b.isActive).length;
  const totalWarehousesCount = allWarehouses.length;
  const totalRegistersCount = registers.length;
  const primaryBranch = allBranches.find((b) => b.code === "MAIN") ?? allBranches[0];

  function openAddBranch() {
    setModalTargetBranchId(null);
    setModalMode("branch");
    setModalOpen(true);
  }

  function openAddWarehouse(branchId?: string) {
    setModalTargetBranchId(branchId ?? null);
    setModalMode("warehouse");
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Hero Header Box */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-900 via-teal-950 to-slate-900 p-6 text-white shadow-lg">
        {/* Glow atmosphere */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-emerald-500/15 blur-2xl"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-300 ring-1 ring-inset ring-teal-400/30">
              <Store className="h-3.5 w-3.5" />
              <span>Multi-Location & Stock Hub</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Branches & Warehouses
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-teal-100/80">
              Manage your retail storefronts, assigned warehouses, and purchase intake
              destinations. Each location operates with its dedicated stock ledger to
              keep POS sales and inventory accurate.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onPress={openAddBranch}
              className="flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-teal-500/30 transition hover:bg-teal-400"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              Add Branch
            </Button>
            <Button
              variant="bordered"
              onPress={() => openAddWarehouse()}
              className="flex items-center gap-2 rounded-xl border-teal-400/40 bg-teal-900/40 text-sm font-semibold text-teal-100 backdrop-blur-sm hover:bg-teal-800/60"
            >
              <Boxes className="h-4 w-4" />
              + Add Warehouse
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1 */}
        <div className="rounded-2xl border border-gulio-border bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gulio-muted">
              Total Branches
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-200">
              <Building2 className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-slate-900">
              {totalBranchesCount}
            </span>
            <span className="text-xs font-medium text-emerald-600">
              ({activeBranchesCount} Active)
            </span>
          </div>
          <p className="mt-1 text-xs text-gulio-muted">
            Operating retail stores
          </p>
        </div>

        {/* KPI 2 */}
        <div className="rounded-2xl border border-gulio-border bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gulio-muted">
              Warehouses
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
              <WarehouseIcon className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-slate-900">
              {totalWarehousesCount}
            </span>
            <span className="text-xs font-medium text-amber-700">
              Stock locations
            </span>
          </div>
          <p className="mt-1 text-xs text-gulio-muted">
            Active purchase intake points
          </p>
        </div>

        {/* KPI 3 */}
        <div className="rounded-2xl border border-gulio-border bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gulio-muted">
              POS Registers
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-200">
              <MonitorSmartphone className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-slate-900">
              {totalRegistersCount}
            </span>
            <span className="text-xs font-medium text-sky-700">Tills</span>
          </div>
          <p className="mt-1 text-xs text-gulio-muted">
            Assigned cashier checkouts
          </p>
        </div>

        {/* KPI 4 */}
        <div className="rounded-2xl border border-gulio-border bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gulio-muted">
              Primary Location (HQ)
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 ring-1 ring-purple-200">
              <ShieldCheck className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5 truncate">
            <span className="truncate text-base font-bold text-slate-900">
              {primaryBranch?.name ?? "Main Store"}
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
              {primaryBranch?.code ?? "MAIN"}
            </span>
          </div>
          <p className="mt-1 text-xs text-gulio-muted">
            Default system branch
          </p>
        </div>
      </div>

      {/* Search & Filter Strip */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gulio-border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by branch name, code, or warehouse..."
            className="w-full rounded-xl border border-gulio-border bg-slate-50/70 pl-10 pr-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === "all"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Branches ({allBranches.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === "active"
                ? "bg-emerald-700 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Active ({activeBranchesCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("multiple_warehouses")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === "multiple_warehouses"
                ? "bg-teal-700 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Multiple Warehouses
          </button>
        </div>
      </div>

      {/* Unassigned Warehouses (if any) */}
      {unassignedWarehouses.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-950">
                  Unassigned Warehouses ({unassignedWarehouses.length})
                </h4>
                <p className="text-xs text-amber-800/90">
                  These warehouses are not currently linked to any active branch. Assign them to a branch to enable inventory tracking and sales.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unassignedWarehouses.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-xl border border-amber-200/80 bg-white p-3 text-xs shadow-2xs"
              >
                <div className="min-w-0">
                  <span className="block truncate font-bold text-slate-900">
                    {w.name}
                  </span>
                  <span className="block text-[10px] text-amber-700">
                    Unlinked Storage
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditWarehouse(w)}
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-teal-700"
                  >
                    <ArrowRightLeft className="h-3 w-3" />
                    Assign to Branch
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeleteWarehouse(w)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Branches List Display */}
      {filteredBranches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
            <Building2 className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">
            No branches match your search
          </h3>
          <p className="mt-1 max-w-sm text-xs text-gulio-muted">
            Try adjusting your search criteria or register a new branch location
            below.
          </p>
          <Button
            onPress={openAddBranch}
            className="mt-4 rounded-xl bg-teal-600 px-4 font-semibold text-white shadow-sm hover:bg-teal-700"
          >
            + Add New Branch
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredBranches.map((b) => {
            const branchWarehouses = allWarehouses.filter((w) => w.branchId === b.id);
            const branchRegisters = registers.filter((r) => r.branchId === b.id);
            const isMain = b.code === "MAIN";

            return (
              <div
                key={b.id}
                className="flex flex-col justify-between rounded-2xl border border-gulio-border bg-white p-5 shadow-sm transition-all hover:border-teal-300 hover:shadow-md"
              >
                {/* Branch Header */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 text-teal-700 ring-1 ring-teal-200">
                        <Store className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">
                            {b.name}
                          </h3>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                            {b.code}
                          </span>
                          {isMain ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                              <Sparkles className="h-3 w-3" />
                              Main HQ
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-gulio-muted">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          <span>Retail Storefront & Checkout</span>
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        b.isActive
                          ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                          : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          b.isActive ? "bg-emerald-600" : "bg-slate-400"
                        }`}
                      />
                      {b.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Warehouses Block */}
                  <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Boxes className="h-3.5 w-3.5 text-teal-600" />
                        Stock Warehouses ({branchWarehouses.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => openAddWarehouse(b.id)}
                        className="text-[11px] font-semibold text-teal-600 hover:text-teal-800 hover:underline"
                      >
                        + Add Warehouse
                      </button>
                    </div>

                    <div className="mt-2.5 space-y-1.5">
                      {branchWarehouses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-3 text-center">
                          <p className="text-xs italic text-slate-400">
                            No warehouses assigned to this branch
                          </p>
                          <button
                            type="button"
                            onClick={() => openAddWarehouse(b.id)}
                            className="mt-1 text-[11px] font-semibold text-teal-600 hover:text-teal-800"
                          >
                            + Assign New Warehouse
                          </button>
                        </div>
                      ) : (
                        branchWarehouses.map((w) => (
                          <div
                            key={w.id}
                            className="group flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white p-2.5 text-xs shadow-2xs transition hover:border-teal-300 hover:shadow-xs"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-200/60">
                                <Boxes className="h-3.5 w-3.5" />
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate font-bold text-slate-900">
                                    {w.name}
                                  </span>
                                  {w.isDefault ? (
                                    <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[9px] font-bold text-teal-700 ring-1 ring-teal-300/80">
                                      Default
                                    </span>
                                  ) : (
                                    <span className="shrink-0 text-[10px] text-slate-400">
                                      Secondary
                                    </span>
                                  )}
                                </div>
                                <span className="block text-[10px] text-slate-400">
                                  ID: <span className="font-mono">{w.id.slice(0, 8)}…</span>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                title="Reassign to another branch or rename"
                                onClick={() => openEditWarehouse(w)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
                              >
                                <ArrowRightLeft className="h-3 w-3 text-teal-600" />
                                <span>Reassign / Edit</span>
                              </button>
                              <button
                                type="button"
                                title="De-assign or remove warehouse"
                                onClick={() => openDeleteWarehouse(w)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Registers Block */}
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50/50 px-3.5 py-2.5 text-xs">
                    <span className="text-gulio-muted">
                      POS Registers:
                    </span>
                    <div className="flex flex-wrap gap-1.5 font-medium text-slate-800">
                      {branchRegisters.length > 0 ? (
                        branchRegisters.map((r) => (
                          <span
                            key={r.id}
                            className="rounded-md bg-white px-2 py-0.5 font-mono text-[11px] shadow-2xs border border-slate-200"
                          >
                            {r.code}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic">
                          1 POS Auto-assigned
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-[11px] text-slate-400">
                    ID: <span className="font-mono">{b.id.slice(0, 8)}…</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openAddWarehouse(b.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      <Plus className="h-3 w-3" />
                      Warehouse
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for adding branch / warehouse */}
      <BranchFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          await refreshOrgContext();
          setRefreshTick((t) => t + 1);
        }}
        mode={modalMode}
        initialBranchId={modalTargetBranchId}
      />

      {/* Modal for managing / re-assigning / de-assigning warehouse */}
      <WarehouseManageModal
        isOpen={manageModalOpen}
        onClose={() => setManageModalOpen(false)}
        onSaved={async () => {
          await refreshOrgContext();
          setRefreshTick((t) => t + 1);
        }}
        warehouse={manageWarehouse}
        allBranches={allBranches}
        initialDeleteMode={manageDeleteMode}
      />
    </div>
  );
}
