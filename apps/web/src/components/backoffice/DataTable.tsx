import type { KeyboardEventHandler, MouseEventHandler, ReactNode } from "react";

type DataTableProps = {
  columns: string[];
  children: ReactNode;
  footer?: ReactNode;
  /** Extra classes on the outer card (e.g. compact panels). */
  className?: string;
  /** Min width of the table; pass smaller values for narrow columns. */
  minWidthClassName?: string;
};

/** Simple card-wrapped table shell for back-office lists. */
export function DataTable({
  columns,
  children,
  footer,
  className = "",
  minWidthClassName = "min-w-[640px]",
}: DataTableProps) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-gulio-border bg-gulio-card shadow-sm ${className}`}
    >
      <div className="overflow-x-auto">
        <table className={`w-full ${minWidthClassName} text-left text-sm`}>
          <thead className="border-b border-gulio-border bg-gulio-bg/80 text-gulio-muted">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-4 py-3 font-medium whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {footer ? (
        <div className="border-t border-gulio-border bg-gulio-bg/40 px-4 py-3 text-xs text-gulio-muted">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function DataTableRow({
  children,
  warn = false,
  selected = false,
  onClick,
  onKeyDown,
  tabIndex,
  role,
}: {
  children: ReactNode;
  warn?: boolean;
  selected?: boolean;
  onClick?: MouseEventHandler<HTMLTableRowElement>;
  onKeyDown?: KeyboardEventHandler<HTMLTableRowElement>;
  tabIndex?: number;
  role?: string;
}) {
  return (
    <tr
      role={role}
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={onKeyDown}
      aria-selected={selected || undefined}
      className={`border-b border-gulio-border last:border-0 transition-colors ${
        onClick ? "cursor-pointer" : ""
      } ${
        selected
          ? "bg-teal-50/80 ring-1 ring-inset ring-teal-500/50 hover:bg-teal-50"
          : warn
            ? "bg-amber-50/40 hover:bg-gulio-bg/60"
            : "hover:bg-gulio-bg/60"
      }`}
    >
      {children}
    </tr>
  );
}

export function DataTableCell({
  children,
  mono = false,
  tabular = false,
  className = "",
}: {
  children: ReactNode;
  mono?: boolean;
  tabular?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-3 ${mono ? "font-mono text-xs" : ""} ${
        tabular ? "tabular-nums" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}
