"use client";

import { useEffect, useId, useRef, useState, type SVGProps } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAuth } from "@/lib/auth-store";
import { useBranchContext } from "@/lib/branch-context";

export function BranchSwitcher() {
  const { orgContext } = useAuth();
  const { selectedBranchId, setSelectedBranchId } = useBranchContext();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchInputId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  const branches = orgContext?.branches ?? [];
  const warehouses = orgContext?.warehouses ?? [];
  const registers = orgContext?.registers ?? [];

  // Server is the source of truth — legacy browser-only branches used non-UUID
  // ids that break stock/sales queries, so they are never offered here.
  const allBranches = branches;

  const selectedBranch = allBranches.find((b) => b.id === selectedBranchId) ?? null;
  const displayName = selectedBranch?.name ?? "All Branches";

  // Focus search input when modal opens
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 80);
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Prevent background body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function handleSelect(id: string | null) {
    setSelectedBranchId(id);
    setOpen(false);
  }

  // Filter branches by search query
  const filteredBranches = allBranches.filter((b) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      b.code.toLowerCase().includes(q)
    );
  });

  const modalContent = open && mounted ? (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="branch-modal-title"
    >
      {/* Frosted dark backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-950/20"
        style={{
          animation: "modalZoomIn 180ms cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      >
        {/* Header */}
        <div className="relative border-b border-slate-100 bg-gradient-to-r from-slate-50 via-sky-50/30 to-slate-50 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-md shadow-sky-500/20">
                <IconBuilding className="h-5 w-5" />
              </div>
              <div>
                <h2
                  id="branch-modal-title"
                  className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl"
                >
                  Select Active Branch
                </h2>
                <p className="text-xs text-slate-500 sm:text-sm">
                  Choose a location to filter sales, stock & registers, or view consolidated data
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-400 shadow-sm transition hover:bg-slate-100 hover:text-slate-700 active:scale-95"
              aria-label="Close dialog"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mt-4">
            <label htmlFor={searchInputId} className="sr-only">
              Search branches
            </label>
            <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              id={searchInputId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search branch by name or code (e.g. Main Store, BGS0001)..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Content / Branch List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {/* Option: All Branches (Only show if search doesn't explicitly filter it out) */}
          {(!searchQuery || "all branches consolidated".includes(searchQuery.toLowerCase())) && (
            <div
              onClick={() => handleSelect(null)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelect(null);
                }
              }}
              className={`group relative flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-all active:scale-[0.99] ${
                selectedBranchId === null
                  ? "border-teal-500 bg-gradient-to-r from-teal-50/90 via-teal-50/40 to-white shadow-md ring-2 ring-teal-500/30"
                  : "border-slate-200/90 bg-white hover:border-teal-300 hover:bg-slate-50/60 hover:shadow-sm"
              }`}
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition ${
                  selectedBranchId === null
                    ? "bg-teal-500 text-white shadow-md shadow-teal-500/25"
                    : "bg-teal-50 text-teal-600 group-hover:bg-teal-100"
                }`}
              >
                <IconGlobe className="h-6 w-6" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-base font-bold ${
                      selectedBranchId === null ? "text-teal-950" : "text-slate-900"
                    }`}
                  >
                    All Branches
                  </span>
                  <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-800">
                    Consolidated View
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  View aggregated sales revenue, unified stock across all warehouses, and all active registers across the business.
                </p>

                <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-500" />
                    {allBranches.length} Total Branches
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>{warehouses.length} Warehouses</span>
                  <span className="text-slate-300">•</span>
                  <span>{registers.length} Registers</span>
                </div>
              </div>

              <div className="shrink-0 pt-1">
                {selectedBranchId === null ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                    <IconCheck className="h-3.5 w-3.5" />
                    Selected
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-400 group-hover:text-teal-600">
                    Select &rarr;
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Section Divider */}
          <div className="flex items-center gap-3 pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Individual Store Branches ({filteredBranches.length})
            </span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          {/* Branch Cards */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {filteredBranches.map((b) => {
              const isSelected = b.id === selectedBranchId;
              const branchWarehouses = warehouses.filter((w) => w.branchId === b.id);
              const branchRegisters = registers.filter((r) => r.branchId === b.id);

              return (
                <div
                  key={b.id}
                  onClick={() => handleSelect(b.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelect(b.id);
                    }
                  }}
                  className={`group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-3.5 transition-all active:scale-[0.99] ${
                    isSelected
                      ? "border-sky-500 bg-gradient-to-br from-sky-50/90 via-sky-50/40 to-white shadow-md ring-2 ring-sky-500/30"
                      : "border-slate-200/90 bg-white hover:border-sky-300 hover:bg-slate-50/70 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                          isSelected
                            ? "bg-sky-500 text-white shadow-sm shadow-sky-500/25"
                            : "bg-sky-50 text-sky-600 group-hover:bg-sky-100"
                        }`}
                      >
                        <IconStore className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span
                          className={`block truncate text-sm font-bold ${
                            isSelected ? "text-sky-950" : "text-slate-900"
                          }`}
                        >
                          {b.name}
                        </span>
                        <span className="inline-block font-mono text-[10px] font-semibold text-slate-500">
                          {b.code}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                          <IconCheck className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              b.isActive !== false ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                          />
                          {b.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Branch metadata summary */}
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100/80 pt-2 text-[11px] text-slate-500">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span>
                        {branchWarehouses.length}{" "}
                        {branchWarehouses.length === 1 ? "warehouse" : "warehouses"}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>
                        {branchRegisters.length}{" "}
                        {branchRegisters.length === 1 ? "register" : "registers"}
                      </span>
                    </div>

                    {!isSelected && (
                      <span className="text-[11px] font-semibold text-sky-600 opacity-0 transition group-hover:opacity-100">
                        Select &rarr;
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty search results */}
          {filteredBranches.length === 0 && searchQuery && (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
              <IconStore className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">No branch found</p>
              <p className="mt-1 text-xs text-slate-400">
                No location matches &ldquo;{searchQuery}&rdquo;. Try another name or code.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col gap-2.5 border-t border-slate-100 bg-slate-50/80 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <IconCog className="h-4 w-4 text-slate-400" />
            <span>Need to add or modify a branch?</span>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="font-semibold text-sky-600 hover:text-sky-700 hover:underline"
            >
              Go to Settings &rarr;
            </Link>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative shrink-0">
      {/* Trigger button in TopBar — clicking opens the modal popup */}
      <button
        type="button"
        id="branch-switcher-btn"
        onClick={() => setOpen(true)}
        className="group inline-flex max-w-[230px] items-center gap-2 rounded-xl border border-sky-200/80 bg-gradient-to-b from-sky-50 to-white px-2.5 py-1.5 text-sky-900 shadow-sm shadow-sky-900/5 transition hover:border-sky-300 hover:from-sky-100/70 hover:shadow active:scale-[0.98]"
        title="Click to switch active branch"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white shadow-xs">
          <IconBuilding className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 text-left leading-tight">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-gulio-muted/90">
            Branch
          </span>
          <span className="block truncate text-[13px] font-bold text-sky-950">
            {displayName}
          </span>
        </span>
        <span className="ml-0.5 rounded-md bg-sky-100/80 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 group-hover:bg-sky-200/80">
          Switch
        </span>
      </button>

      {/* Render modal portal to document body */}
      {mounted && typeof document !== "undefined" && createPortal(modalContent, document.body)}
    </div>
  );
}

function IconBuilding(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 21V5a1 1 0 011-1h8a1 1 0 011 1v16" strokeLinejoin="round" />
      <path d="M14 10h5a1 1 0 011 1v10" strokeLinejoin="round" />
      <path d="M8 8h2M8 12h2M8 16h2M17 14h1M17 17h1" strokeLinecap="round" />
    </svg>
  );
}

function IconGlobe(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c-3 3-5 5.5-5 9s2 6 5 9m0-18c3 3 5 5.5 5 9s-2 6-5 9" strokeLinejoin="round" />
      <path d="M3 12h18" strokeLinecap="round" />
    </svg>
  );
}

function IconStore(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 9l9-6 9 6v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinejoin="round" />
      <path d="M9 22V12h6v10" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCog(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
