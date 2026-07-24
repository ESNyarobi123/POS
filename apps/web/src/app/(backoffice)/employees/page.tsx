"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  AssignableRoleCode,
  CreateUserRequest,
  OrgUserDto,
  OrgUserListResponse,
  ReplaceUserPermissionsRequest,
  UserPermissionsResponse,
} from "@gulio/contracts";
import {
  AccessDeniedPanel,
  PermissionGate,
} from "@/components/backoffice/PermissionGate";
import { EmptyState } from "@/components/backoffice/EmptyState";
import { PageHeader } from "@/components/backoffice/PageHeader";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
} from "@/components/backoffice/DataTable";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import {
  COMMON_POS_PERMISSIONS,
  PermissionCode,
  usePermissions,
} from "@/lib/permissions";

type OverrideMode = "default" | "grant" | "deny";

export default function EmployeesPage() {
  return (
    <PermissionGate permission={PermissionCode.USERS_MANAGE}>
      <EmployeesPageInner />
    </PermissionGate>
  );
}

function EmployeesPageInner() {
  const { ready, token } = useAuth();
  const { isOwner } = usePermissions();
  const [users, setUsers] = useState<OrgUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleCode, setRoleCode] = useState<AssignableRoleCode>("CASHIER");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const res = await apiFetch<OrgUserListResponse>("/users");
      setUsers(res.users);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setForbidden(true);
        setUsers([]);
      } else {
        setError(
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Failed to load employees",
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !token) return;
    void loadUsers();
  }, [ready, token, loadUsers]);

  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) ?? null,
    [users, selectedId],
  );

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      const body: CreateUserRequest = {
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        roleCode,
      };
      const created = await apiFetch<OrgUserDto>("/users", {
        method: "POST",
        body,
      });
      setUsers((prev) =>
        [...prev, created].sort((a, b) =>
          a.fullName.localeCompare(b.fullName),
        ),
      );
      setFullName("");
      setEmail("");
      setPassword("");
      setRoleCode("CASHIER");
      setShowForm(false);
      setSelectedId(created.id);
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not create user",
      );
    } finally {
      setCreating(false);
    }
  }

  async function toggleLock(user: OrgUserDto) {
    setBusyId(user.id);
    setError(null);
    try {
      const path = user.isActive
        ? `/users/${user.id}/lock`
        : `/users/${user.id}/unlock`;
      const updated = await apiFetch<OrgUserDto>(path, { method: "POST" });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Lock action failed",
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  if (forbidden) {
    return (
      <AccessDeniedPanel
        need={PermissionCode.USERS_MANAGE}
        message="You don’t have access to manage employees."
      />
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-7.5rem)] flex-col">
      <PageHeader
        title="Employees"
        subtitle="Invite staff, lock accounts, and override permissions"
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex min-h-touch items-center rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gulio-primary-hover"
          >
            {showForm ? "Close form" : "Add employee"}
          </button>
        }
      />

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"
        >
          {error}
        </div>
      ) : null}

      {showForm ? (
        <form
          onSubmit={onCreate}
          className="mb-5 rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm"
        >
          <h2 className="mb-4 text-sm font-semibold text-gulio-text">
            New employee
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledInput
              label="Full name"
              value={fullName}
              onChange={setFullName}
              required
              autoComplete="name"
            />
            <LabeledInput
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              required
              autoComplete="off"
            />
            <LabeledInput
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              required
              autoComplete="new-password"
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gulio-text">
                Role
              </label>
              <select
                value={roleCode}
                onChange={(e) =>
                  setRoleCode(e.target.value as AssignableRoleCode)
                }
                className="w-full rounded-xl border border-gulio-border bg-white px-3.5 py-2.5 text-sm outline-none ring-gulio-primary focus:ring-2"
              >
                <option value="CASHIER">Cashier</option>
                {isOwner() ? (
                  <option value="MANAGER">Manager</option>
                ) : null}
              </select>
              {!isOwner() ? (
                <p className="mt-1 text-xs text-gulio-muted">
                  Only owners can assign the Manager role.
                </p>
              ) : null}
            </div>
          </div>
          {formError ? (
            <p className="mt-3 text-sm text-gulio-error" role="alert">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={creating}
            className="mt-4 rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-gulio-primary-hover disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create employee"}
          </button>
        </form>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,1fr)]">
        <div className="min-w-0">
          {loading ? (
            <p className="text-sm text-gulio-muted">Loading employees…</p>
          ) : users.length === 0 ? (
            <EmptyState
              title="No employees yet"
              description="Create a cashier or manager account to get started."
            />
          ) : (
            <DataTable
              columns={["Employee", "Role", "Status", ""]}
              footer={`${users.length} user${users.length === 1 ? "" : "s"}`}
            >
              {users.map((u) => {
                const active = u.id === selectedId;
                return (
                  <DataTableRow
                    key={u.id}
                    selected={active}
                    onClick={() =>
                      setSelectedId((prev) => (prev === u.id ? null : u.id))
                    }
                    role="button"
                    tabIndex={0}
                  >
                    <DataTableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-semibold text-violet-700">
                          {initials(u.fullName)}
                        </span>
                        <span>
                          <span className="block font-medium text-gulio-text">
                            {u.fullName}
                          </span>
                          <span className="block text-xs text-gulio-muted">
                            {u.email}
                          </span>
                        </span>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="text-sm text-gulio-text">
                        {u.roles.join(", ") || "—"}
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge active={u.isActive} />
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleLock(u);
                        }}
                        className="rounded-lg border border-gulio-border bg-white px-2.5 py-1.5 text-xs font-semibold text-gulio-text hover:bg-gulio-bg disabled:opacity-60"
                      >
                        {busyId === u.id
                          ? "…"
                          : u.isActive
                            ? "Lock"
                            : "Unlock"}
                      </button>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTable>
          )}
        </div>

        <div className="min-w-0">
          {selected ? (
            <PermissionEditor
              user={selected}
              onSaved={() => void loadUsers()}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-gulio-border bg-gulio-card/60 p-6 text-center">
              <p className="text-sm font-medium text-gulio-text">
                Select an employee
              </p>
              <p className="mt-1 text-sm text-gulio-muted">
                View role permissions and set grant / deny overrides.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PermissionEditor({
  user,
  onSaved,
}: {
  user: OrgUserDto;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, OverrideMode>>({});
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setSavedMsg(null);
      try {
        const res = await apiFetch<UserPermissionsResponse>(
          `/users/${user.id}/permissions`,
        );
        if (cancelled) return;
        setRolePermissions(res.rolePermissions);
        const next: Record<string, OverrideMode> = {};
        for (const code of res.grants) next[code] = "grant";
        for (const code of res.denies) next[code] = "deny";
        setOverrides(next);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Failed to load permissions",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  function setMode(code: string, mode: OverrideMode) {
    setOverrides((prev) => {
      const next = { ...prev };
      if (mode === "default") delete next[code];
      else next[code] = mode;
      return next;
    });
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    const grants: string[] = [];
    const denies: string[] = [];
    for (const [code, mode] of Object.entries(overrides)) {
      if (mode === "grant") grants.push(code);
      if (mode === "deny") denies.push(code);
    }
    const body: ReplaceUserPermissionsRequest = { grants, denies };
    try {
      const res = await apiFetch<UserPermissionsResponse>(
        `/users/${user.id}/permissions`,
        { method: "PUT", body },
      );
      setRolePermissions(res.rolePermissions);
      const next: Record<string, OverrideMode> = {};
      for (const code of res.grants) next[code] = "grant";
      for (const code of res.denies) next[code] = "deny";
      setOverrides(next);
      setSavedMsg("Permissions saved.");
      onSaved();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Save failed",
      );
    } finally {
      setSaving(false);
    }
  }

  const groups = useMemo(() => {
    const map = new Map<
      string,
      Array<{ code: string; label: string; group: string }>
    >();
    for (const item of COMMON_POS_PERMISSIONS) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gulio-text">{user.fullName}</h2>
          <p className="text-sm text-gulio-muted">{user.email}</p>
          <p className="mt-1 text-xs text-gulio-muted">
            Roles: {user.roles.join(", ") || "—"}
          </p>
        </div>
        <StatusBadge active={user.isActive} />
      </div>

      {loading ? (
        <p className="text-sm text-gulio-muted">Loading permissions…</p>
      ) : (
        <>
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gulio-muted">
              Role permissions (read-only)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rolePermissions.length === 0 ? (
                <span className="text-sm text-gulio-muted">None</span>
              ) : (
                rolePermissions.map((code) => (
                  <span
                    key={code}
                    className="rounded-lg bg-gulio-bg px-2 py-1 font-mono text-[11px] text-gulio-text"
                  >
                    {code}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="mb-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gulio-muted">
              Overrides — Grant / Deny
            </p>
            {groups.map(([group, items]) => (
              <div key={group}>
                <p className="mb-2 text-sm font-medium text-gulio-text">
                  {group}
                </p>
                <ul className="space-y-2">
                  {items.map((item) => {
                    const mode = overrides[item.code] ?? "default";
                    const fromRole = rolePermissions.includes(item.code);
                    return (
                      <li
                        key={item.code}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gulio-border px-3 py-2"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gulio-text">
                            {item.label}
                          </span>
                          <span className="font-mono text-[11px] text-gulio-muted">
                            {item.code}
                            {fromRole ? " · role" : ""}
                          </span>
                        </span>
                        <div className="flex shrink-0 gap-1">
                          {(
                            [
                              ["default", "Default"],
                              ["grant", "Grant"],
                              ["deny", "Deny"],
                            ] as const
                          ).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setMode(item.code, value)}
                              className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                                mode === value
                                  ? value === "grant"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : value === "deny"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-slate-200 text-slate-800"
                                  : "bg-white text-gulio-muted hover:bg-gulio-bg"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {error ? (
            <p className="mb-3 text-sm text-gulio-error" role="alert">
              {error}
            </p>
          ) : null}
          {savedMsg ? (
            <p className="mb-3 text-sm text-emerald-700">{savedMsg}</p>
          ) : null}

          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave()}
            className="w-full rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-gulio-primary-hover disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save permissions"}
          </button>
        </>
      )}
    </section>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-800"
          : "bg-rose-50 text-rose-800"
      }`}
    >
      {active ? "Active" : "Locked"}
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  required,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gulio-text">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-gulio-border px-3.5 py-2.5 text-sm outline-none ring-gulio-primary focus:ring-2"
      />
    </div>
  );
}
