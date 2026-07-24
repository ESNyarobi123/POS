"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuditLogDto, AuditLogListResponse } from "@gulio/contracts";
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
import { PermissionCode } from "@/lib/permissions";

export default function AuditLogsPage() {
  return (
    <PermissionGate permission={PermissionCode.AUDIT_VIEW}>
      <AuditLogsPageInner />
    </PermissionGate>
  );
}

function AuditLogsPageInner() {
  const { ready, token } = useAuth();
  const [logs, setLogs] = useState<AuditLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      setForbidden(false);
      try {
        const res = await apiFetch<AuditLogListResponse>(
          "/audit-logs?limit=50",
        );
        if (cancelled) return;
        setLogs(res.logs);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 403) {
          setForbidden(true);
          setLogs([]);
        } else {
          setError(
            e instanceof ApiError
              ? e.message
              : e instanceof Error
                ? e.message
                : "Failed to load audit logs",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  const footer = useMemo(
    () => `${logs.length} event${logs.length === 1 ? "" : "s"} · last 50`,
    [logs.length],
  );

  if (forbidden) {
    return (
      <AccessDeniedPanel
        need={PermissionCode.AUDIT_VIEW}
        message="You don’t have access to view audit logs."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Audit logs"
        subtitle="Privileged actions — discounts, voids, permission changes, locks"
      />

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-gulio-muted">Loading audit logs…</p>
      ) : logs.length === 0 ? (
        <EmptyState
          title="No audit events yet"
          description="Locks, permission changes, and other privileged actions will appear here."
        />
      ) : (
        <DataTable
          columns={["Action", "Entity", "User", "Time", "Meta"]}
          footer={footer}
          minWidthClassName="min-w-[720px]"
        >
          {logs.map((log) => (
            <DataTableRow key={log.id}>
              <DataTableCell>
                <span className="font-medium text-gulio-text">{log.action}</span>
              </DataTableCell>
              <DataTableCell>
                <span className="block text-sm text-gulio-text">
                  {log.entityType}
                </span>
                {log.entityId ? (
                  <span className="block font-mono text-[11px] text-gulio-muted">
                    {shortId(log.entityId)}
                  </span>
                ) : null}
              </DataTableCell>
              <DataTableCell className="font-mono text-xs text-gulio-muted">
                {log.actorUserId ? shortId(log.actorUserId) : "—"}
              </DataTableCell>
              <DataTableCell className="whitespace-nowrap text-sm text-gulio-muted">
                {formatWhen(log.createdAt)}
              </DataTableCell>
              <DataTableCell>
                <MetaCell before={log.beforeJson} after={log.afterJson} />
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}
    </div>
  );
}

function MetaCell({
  before,
  after,
}: {
  before: unknown;
  after: unknown;
}) {
  const summary = summarizeMeta(before, after);
  if (!summary) {
    return <span className="text-gulio-muted">—</span>;
  }
  return (
    <span
      className="block max-w-[220px] truncate font-mono text-[11px] text-gulio-muted"
      title={summary}
    >
      {summary}
    </span>
  );
}

function summarizeMeta(before: unknown, after: unknown): string {
  const parts: string[] = [];
  if (after != null) parts.push(`after: ${compactJson(after)}`);
  else if (before != null) parts.push(`before: ${compactJson(before)}`);
  return parts.join(" · ");
}

function compactJson(value: unknown): string {
  try {
    const s = JSON.stringify(value);
    return s.length > 80 ? `${s.slice(0, 77)}…` : s;
  } catch {
    return String(value);
  }
}

function shortId(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 8)}…`;
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
