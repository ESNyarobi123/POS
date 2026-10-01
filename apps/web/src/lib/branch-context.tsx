"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./auth-store";
import { isUuid } from "./api";

const STORAGE_KEY = "gulio_selected_branch_id";

/** Pre-API fallback keys that held browser-only branches/warehouses with non-UUID ids. */
const LEGACY_LOCAL_KEYS = [
  "gulio_custom_branches",
  "gulio_custom_warehouses",
  "gulio_warehouse_assignments",
  "gulio_deleted_warehouses",
];

export type ResolvedBranch = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

export type ResolvedWarehouse = {
  id: string;
  name: string;
  branchId: string;
  isDefault: boolean;
};

type BranchContextValue = {
  /** null means "All Branches" (consolidated view) */
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  isAllBranches: boolean;
  selectedBranch: ResolvedBranch | null;
  allBranches: ResolvedBranch[];
  allWarehouses: ResolvedWarehouse[];
  targetWarehouses: ResolvedWarehouse[];
  refreshBranches: () => void;
};

const BranchCtx = createContext<BranchContextValue>({
  selectedBranchId: null,
  setSelectedBranchId: () => undefined,
  isAllBranches: true,
  selectedBranch: null,
  allBranches: [],
  allWarehouses: [],
  targetWarehouses: [],
  refreshBranches: () => undefined,
});

export function BranchContextProvider({ children }: { children: ReactNode }) {
  const { orgContext, refreshOrgContext } = useAuth();
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null);

  // Initialize from localStorage on client mount
  useEffect(() => {
    try {
      for (const key of LEGACY_LOCAL_KEYS) localStorage.removeItem(key);
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored !== "null" && stored !== "" && isUuid(stored)) {
        setSelectedBranchIdState(stored);
      } else if (stored) {
        // Legacy / stale branch id that no longer exists on the server.
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore localStorage errors */
    }
  }, []);

  const setSelectedBranchId = useCallback((id: string | null) => {
    setSelectedBranchIdState(id);
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      // Broadcast custom event for immediate multi-component re-evaluation
      window.dispatchEvent(
        new CustomEvent("gulio_branch_change", { detail: { branchId: id } }),
      );
    } catch {
      /* ignore */
    }
  }, []);

  // Listen to cross-component or cross-tab branch changes
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setSelectedBranchIdState(e.newValue && e.newValue !== "null" ? e.newValue : null);
      }
    }
    function handleCustomEvent(e: Event) {
      const detail = (e as CustomEvent<{ branchId: string | null }>).detail;
      if (detail && Object.prototype.hasOwnProperty.call(detail, "branchId")) {
        setSelectedBranchIdState(detail.branchId);
      }
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("gulio_branch_change", handleCustomEvent);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("gulio_branch_change", handleCustomEvent);
    };
  }, []);

  const refreshBranches = useCallback(() => {
    void refreshOrgContext();
  }, [refreshOrgContext]);

  const allBranches = useMemo<ResolvedBranch[]>(
    () =>
      (orgContext?.branches ?? [])
        .filter((b) => isUuid(b.id))
        .map((b) => ({
          id: b.id,
          name: b.name,
          code: b.code,
          isActive: b.isActive,
        })),
    [orgContext?.branches],
  );

  const allWarehouses = useMemo<ResolvedWarehouse[]>(
    () =>
      (orgContext?.warehouses ?? [])
        .filter((w) => isUuid(w.id))
        .map((w) => ({
          id: w.id,
          name: w.name,
          branchId: w.branchId,
          isDefault: w.isDefault,
        })),
    [orgContext?.warehouses],
  );

  const selectedBranch = useMemo<ResolvedBranch | null>(() => {
    if (!selectedBranchId) return null;
    return allBranches.find((b) => b.id === selectedBranchId) ?? null;
  }, [allBranches, selectedBranchId]);

  const targetWarehouses = useMemo<ResolvedWarehouse[]>(() => {
    if (selectedBranchId) {
      return allWarehouses.filter((w) => w.branchId === selectedBranchId);
    }
    return allWarehouses;
  }, [allWarehouses, selectedBranchId]);

  const value = useMemo<BranchContextValue>(
    () => ({
      selectedBranchId,
      setSelectedBranchId,
      isAllBranches: selectedBranchId === null,
      selectedBranch,
      allBranches,
      allWarehouses,
      targetWarehouses,
      refreshBranches,
    }),
    [
      selectedBranchId,
      setSelectedBranchId,
      selectedBranch,
      allBranches,
      allWarehouses,
      targetWarehouses,
      refreshBranches,
    ],
  );

  return <BranchCtx.Provider value={value}>{children}</BranchCtx.Provider>;
}

export function useBranchContext() {
  return useContext(BranchCtx);
}
