"use client";

import { useState } from "react";
import { PageHeader } from "@/components/backoffice/PageHeader";
import { PermissionGate } from "@/components/backoffice/PermissionGate";
import { useAuth } from "@/lib/auth-store";
import { PermissionCode } from "@/lib/permissions";

export default function SettingsPage() {
  return (
    <PermissionGate permission={PermissionCode.SETTINGS_MANAGE}>
      <SettingsPageInner />
    </PermissionGate>
  );
}

function SettingsPageInner() {
  const { orgContext, user } = useAuth();
  const [saved, setSaved] = useState(false);
  const orgName = orgContext?.organization.name ?? "Gisee Company Ltd";
  const currency = orgContext?.organization.currencyCode ?? "TZS";

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Organization, receipts, tax, and discount policy — configurable business rules"
        actions={
          <button
            type="button"
            onClick={() => setSaved(true)}
            className="inline-flex min-h-touch items-center rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gulio-primary-hover"
          >
            Save settings (mock)
          </button>
        }
      />

      {saved ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Settings saved (mock). Real persistence lands with settings.manage API.
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <SettingsCard
          title="Organization"
          description="Legal identity shown on receipts and fiscal docs"
        >
          <Field label="Legal name" defaultValue={orgName} />
          <Field label="TIN" defaultValue="123-456-789" />
          <Field label="Default currency" defaultValue={currency} />
          <Field
            label="Timezone"
            defaultValue={orgContext?.organization.timezone ?? "Africa/Dar_es_Salaam"}
          />
        </SettingsCard>

        <SettingsCard
          title="Tax & receipts"
          description="VAT and footer copy for printed / digital receipts"
        >
          <Field label="VAT rate" defaultValue="18%" />
          <Field label="Receipt footer" defaultValue="Asante! Karibu tena." />
          <Toggle
            label="Fiscal provider enabled"
            hint="MockFiscalProvider — sales can stay FISCAL_PENDING"
            defaultChecked
          />
        </SettingsCard>

        <SettingsCard
          title="Discount policy"
          description="Caps enforced on the backend — UI alone is not enough"
        >
          <Field label="Cashier max discount %" defaultValue="5" />
          <Field label="Manager max discount %" defaultValue="20" />
          <Field label="Large refund threshold (TZS)" defaultValue="500,000" />
        </SettingsCard>

        <SettingsCard
          title="Session & security"
          description="Signed-in operator context"
        >
          <ReadonlyRow label="Signed in as" value={user?.fullName ?? "—"} />
          <ReadonlyRow label="Email" value={user?.email ?? "—"} />
          <ReadonlyRow
            label="Roles"
            value={user?.roles?.join(", ") || "—"}
          />
          <Toggle
            label="Require manager PIN for voids"
            hint="Audited privileged action"
            defaultChecked
          />
        </SettingsCard>
      </div>
    </div>
  );
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gulio-border bg-gulio-card p-5 shadow-sm sm:p-6">
      <h2 className="font-semibold text-gulio-text">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-gulio-muted">{description}</p>
      ) : null}
      <div className="mt-4 space-y-3.5">{children}</div>
    </section>
  );
}

function Field({
  label,
  defaultValue,
}: {
  label: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gulio-muted">
        {label}
      </label>
      <input
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-gulio-border px-3.5 py-2.5 text-sm outline-none ring-gulio-primary focus:ring-2"
      />
    </div>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-gulio-bg/70 px-3.5 py-2.5">
      <span className="text-sm text-gulio-muted">{label}</span>
      <span className="truncate text-sm font-medium text-gulio-text">{value}</span>
    </div>
  );
}

function Toggle({
  label,
  hint,
  defaultChecked,
}: {
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gulio-border px-3.5 py-3">
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 rounded border-gulio-border text-gulio-primary"
      />
      <span>
        <span className="block text-sm font-medium text-gulio-text">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-xs text-gulio-muted">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}
