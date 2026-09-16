"use client";

import { FormEvent, useEffect, useState } from "react";
import type {
  OrganizationSettingsDto,
  UpdateOrganizationSettingsRequest,
} from "@gulio/contracts";
import { PageHeader } from "@/components/backoffice/PageHeader";
import { PermissionGate } from "@/components/backoffice/PermissionGate";
import { ApiError, apiFetch } from "@/lib/api";
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
  const { orgContext, user, refreshOrgContext } = useAuth();
  const orgName = orgContext?.organization.name ?? "Gisee Company Ltd";
  const currency = orgContext?.organization.currencyCode ?? "TZS";

  const [percent, setPercent] = useState("5");
  const [allowAboveList, setAllowAboveList] = useState(true);
  const [blockBelowCost, setBlockBelowCost] = useState(true);
  const [selcomEnabled, setSelcomEnabled] = useState(false);
  const [selcomBaseUrl, setSelcomBaseUrl] = useState("");
  const [selcomMerchantId, setSelcomMerchantId] = useState("");
  const [selcomApiKey, setSelcomApiKey] = useState("");
  const [selcomApiSecret, setSelcomApiSecret] = useState("");
  const [selcomWebhookUrl, setSelcomWebhookUrl] = useState("");
  const [selcomKeyMasked, setSelcomKeyMasked] = useState("");
  const [selcomSecretMasked, setSelcomSecretMasked] = useState("");
  const [selcomConfigured, setSelcomConfigured] = useState(false);
  const [oeEnabled, setOeEnabled] = useState(false);
  const [oeBaseUrl, setOeBaseUrl] = useState("https://opticedgeafrica.net");
  const [oeToken, setOeToken] = useState("");
  const [oeTokenMasked, setOeTokenMasked] = useState("");
  const [oeConfigured, setOeConfigured] = useState(false);
  const [savingOe, setSavingOe] = useState(false);
  const [oeSaved, setOeSaved] = useState(false);
  const [savingSelcom, setSavingSelcom] = useState(false);
  const [selcomSaved, setSelcomSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const settings = await apiFetch<OrganizationSettingsDto>(
          "/organization/settings",
        );
        if (cancelled) return;
        setPercent(String(settings.priceOverride.cashierMaxPercentBelowList));
        setAllowAboveList(settings.priceOverride.allowAboveList);
        setBlockBelowCost(settings.priceOverride.blockBelowCost);
        if (settings.selcom) {
          setSelcomEnabled(settings.selcom.enabled);
          setSelcomConfigured(settings.selcom.configured);
          setSelcomBaseUrl(settings.selcom.baseUrl);
          setSelcomMerchantId(settings.selcom.merchantId);
          setSelcomWebhookUrl(settings.selcom.webhookUrl);
          setSelcomKeyMasked(settings.selcom.apiKeyMasked);
          setSelcomSecretMasked(settings.selcom.apiSecretMasked);
        }
        if (settings.opticedge) {
          setOeEnabled(settings.opticedge.enabled);
          setOeConfigured(settings.opticedge.configured);
          setOeBaseUrl(
            settings.opticedge.baseUrl || "https://opticedgeafrica.net",
          );
          setOeTokenMasked(settings.opticedge.apiTokenMasked);
        }
      } catch {
        const fallback = orgContext?.settings?.priceOverride;
        if (fallback) {
          setPercent(String(fallback.cashierMaxPercentBelowList));
          setAllowAboveList(fallback.allowAboveList);
          setBlockBelowCost(fallback.blockBelowCost);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgContext?.settings?.priceOverride]);

  async function onSave(e?: FormEvent) {
    e?.preventDefault();
    const n = Number(percent);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setError("Cashier max % must be between 0 and 100");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body: UpdateOrganizationSettingsRequest = {
        priceOverride: {
          cashierMaxPercentBelowList: n,
          allowAboveList,
          blockBelowCost,
        },
      };
      const updated = await apiFetch<OrganizationSettingsDto>(
        "/organization/settings",
        { method: "PATCH", body },
      );
      setPercent(String(updated.priceOverride.cashierMaxPercentBelowList));
      setAllowAboveList(updated.priceOverride.allowAboveList);
      setBlockBelowCost(updated.priceOverride.blockBelowCost);
      await refreshOrgContext();
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not save settings",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onSaveSelcom(e?: FormEvent) {
    e?.preventDefault();
    setSavingSelcom(true);
    setError(null);
    setSelcomSaved(false);
    try {
      const body: UpdateOrganizationSettingsRequest = {
        selcom: {
          enabled: selcomEnabled,
          baseUrl: selcomBaseUrl,
          merchantId: selcomMerchantId,
          webhookUrl: selcomWebhookUrl,
          apiKey: selcomApiKey.trim() || undefined,
          apiSecret: selcomApiSecret.trim() || undefined,
        },
      };
      const updated = await apiFetch<OrganizationSettingsDto>(
        "/organization/settings",
        { method: "PATCH", body },
      );
      setSelcomEnabled(updated.selcom.enabled);
      setSelcomConfigured(updated.selcom.configured);
      setSelcomBaseUrl(updated.selcom.baseUrl);
      setSelcomMerchantId(updated.selcom.merchantId);
      setSelcomWebhookUrl(updated.selcom.webhookUrl);
      setSelcomKeyMasked(updated.selcom.apiKeyMasked);
      setSelcomSecretMasked(updated.selcom.apiSecretMasked);
      setSelcomApiKey("");
      setSelcomApiSecret("");
      await refreshOrgContext();
      setSelcomSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not save Selcom settings",
      );
    } finally {
      setSavingSelcom(false);
    }
  }

  async function onSaveOpticEdge(e?: FormEvent) {
    e?.preventDefault();
    setSavingOe(true);
    setError(null);
    setOeSaved(false);
    try {
      const body: UpdateOrganizationSettingsRequest = {
        opticedge: {
          enabled: oeEnabled,
          baseUrl: oeBaseUrl,
          apiToken: oeToken.trim() || undefined,
        },
      };
      const updated = await apiFetch<OrganizationSettingsDto>(
        "/organization/settings",
        { method: "PATCH", body },
      );
      setOeEnabled(updated.opticedge.enabled);
      setOeConfigured(updated.opticedge.configured);
      setOeBaseUrl(updated.opticedge.baseUrl);
      setOeTokenMasked(updated.opticedge.apiTokenMasked);
      setOeToken("");
      await refreshOrgContext();
      setOeSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not save OpticEdge settings",
      );
    } finally {
      setSavingOe(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Organization, receipts, tax, and discount policy — configurable business rules"
        actions={
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || loading}
            className="inline-flex min-h-touch items-center rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gulio-primary-hover disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save negotiation policy"}
          </button>
        }
      />

      {saved ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Negotiation policy saved. Cashiers follow these rules on the next sale.
        </div>
      ) : null}
      {selcomSaved ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Selcom saved. POS Mobile now sends a live push to the customer phone.
        </div>
      ) : null}
      {oeSaved ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          OpticEdge saved. POS BANK fetches channels and cash sales post cash-in.
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <form className="lg:col-span-2" onSubmit={(e) => void onSaveSelcom(e)}>
          <SettingsCard
            title="Selcom mobile money"
            description="API details from Selcom. After Save, POS Mobile sends a push to the customer number."
          >
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gulio-border bg-gulio-bg/60 px-3.5 py-3">
              <p className="text-sm text-gulio-muted">
                {selcomConfigured
                  ? "Keys are stored. Cashiers can send a live push."
                  : "Not live yet — paste the Selcom base URL, vendor ID, API key, and secret."}
              </p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  selcomEnabled && selcomConfigured
                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
                    : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
                }`}
              >
                {selcomEnabled && selcomConfigured ? "Live" : "Off"}
              </span>
            </div>
            <ToggleControlled
              label="Enable Selcom push on POS Mobile"
              hint="Cashiers stay on the payment screen. The customer approves on their phone."
              checked={selcomEnabled}
              onChange={setSelcomEnabled}
              disabled={loading || savingSelcom}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldControlled
                label="API base URL"
                value={selcomBaseUrl}
                onChange={setSelcomBaseUrl}
                placeholder="https://… (from Selcom, not example.com)"
                disabled={loading || savingSelcom}
              />
              <FieldControlled
                label="Vendor / merchant ID"
                value={selcomMerchantId}
                onChange={setSelcomMerchantId}
                placeholder="Vendor ID from Selcom"
                disabled={loading || savingSelcom}
              />
              <FieldControlled
                label="API key"
                value={selcomApiKey}
                onChange={setSelcomApiKey}
                placeholder={selcomKeyMasked || "Paste API key"}
                disabled={loading || savingSelcom}
                secret
              />
              <FieldControlled
                label="API secret"
                value={selcomApiSecret}
                onChange={setSelcomApiSecret}
                placeholder={selcomSecretMasked || "Paste API secret"}
                disabled={loading || savingSelcom}
                secret
              />
              <div className="sm:col-span-2">
                <FieldControlled
                  label="Checkout webhook URL"
                  value={selcomWebhookUrl}
                  onChange={setSelcomWebhookUrl}
                  placeholder="https://your-api/payments/selcom/webhooks/checkout"
                  disabled={loading || savingSelcom}
                />
                <p className="mt-1.5 text-xs text-gulio-muted">
                  Give this URL to Selcom. Leave blank to use this API’s default
                  webhook path.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSelcom || loading}
                className="inline-flex min-h-touch items-center rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gulio-primary-hover disabled:opacity-60"
              >
                {savingSelcom ? "Saving…" : "Save Selcom APIs"}
              </button>
            </div>
          </SettingsCard>
        </form>

        <form className="lg:col-span-2" onSubmit={(e) => void onSaveOpticEdge(e)}>
          <SettingsCard
            title="OpticEdge cash & bank"
            description="Bearer token from OpticEdge. After Save, POS BANK loads channels and CASH posts a cash-in."
          >
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gulio-border bg-gulio-bg/60 px-3.5 py-3">
              <p className="text-sm text-gulio-muted">
                {oeConfigured
                  ? "Token is stored. Cashiers can pick Cash, CRDB, and other channels."
                  : "Not live yet — paste the OpticEdge base URL and API token."}
              </p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  oeEnabled && oeConfigured
                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
                    : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
                }`}
              >
                {oeEnabled && oeConfigured ? "Live" : "Off"}
              </span>
            </div>
            <ToggleControlled
              label="Enable OpticEdge channels on POS"
              hint="BANK fetches tills. CASH also posts to the Cash channel after the sale."
              checked={oeEnabled}
              onChange={setOeEnabled}
              disabled={loading || savingOe}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldControlled
                label="API base URL"
                value={oeBaseUrl}
                onChange={setOeBaseUrl}
                placeholder="https://opticedgeafrica.net"
                disabled={loading || savingOe}
              />
              <FieldControlled
                label="API token"
                value={oeToken}
                onChange={setOeToken}
                placeholder={oeTokenMasked || "Paste Bearer token"}
                disabled={loading || savingOe}
                secret
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingOe || loading}
                className="inline-flex min-h-touch items-center rounded-xl bg-gulio-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gulio-primary-hover disabled:opacity-60"
              >
                {savingOe ? "Saving…" : "Save OpticEdge APIs"}
              </button>
            </div>
          </SettingsCard>
        </form>

        <SettingsCard
          title="Organization"
          description="Legal identity shown on receipts and fiscal docs"
        >
          <Field label="Legal name" defaultValue={orgName} />
          <Field label="TIN" defaultValue="123-456-789" />
          <Field label="Default currency" defaultValue={currency} />
          <Field
            label="Timezone"
            defaultValue={
              orgContext?.organization.timezone ?? "Africa/Dar_es_Salaam"
            }
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

        <form onSubmit={(e) => void onSave(e)}>
          <SettingsCard
            title="Price negotiation"
            description="Cashiers follow this policy. Catalog sell price is never changed."
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gulio-muted">
                Cashier max % below list without PIN
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={percent}
                disabled={loading || saving}
                onChange={(e) => setPercent(e.target.value)}
                className="w-full rounded-xl border border-gulio-border px-3.5 py-2.5 text-sm tabular-nums outline-none ring-gulio-primary focus:ring-2"
              />
              <p className="mt-1.5 text-xs text-gulio-muted">
                Example: 5% on TZS 10,000 → cashier may charge TZS 9,500 without a
                manager.
              </p>
            </div>
            <ToggleControlled
              label="Allow price above list"
              hint="Raises revenue — always audited. No PIN required."
              checked={allowAboveList}
              onChange={setAllowAboveList}
              disabled={loading || saving}
            />
            <ToggleControlled
              label="Block below cost (PIN to proceed)"
              hint="Cashier is stopped. Owner/Manager PIN can still complete the sale."
              checked={blockBelowCost}
              onChange={setBlockBelowCost}
              disabled={loading || saving}
            />
          </SettingsCard>
        </form>

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

function FieldControlled({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  secret,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  secret?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gulio-muted">
        {label}
      </label>
      <input
        type={secret ? "password" : "text"}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gulio-border px-3.5 py-2.5 text-sm outline-none ring-gulio-primary focus:ring-2"
      />
    </div>
  );
}

function ToggleControlled({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gulio-border px-3.5 py-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
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
