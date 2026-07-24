import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gulio-border bg-gulio-card px-6 py-16 text-center">
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gulio-bg text-gulio-muted">
          {icon}
        </div>
      ) : null}
      <p className="text-base font-semibold text-gulio-text">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-gulio-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
