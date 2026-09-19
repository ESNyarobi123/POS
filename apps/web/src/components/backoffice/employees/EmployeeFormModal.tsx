"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import type {
  AssignableRoleCode,
  CreateUserRequest,
  OrgUserDto,
  UpdateUserRequest,
} from "@gulio/contracts";
import { ApiError, apiFetch } from "@/lib/api";

type Props = {
  isOpen: boolean;
  mode: "create" | "edit";
  user?: OrgUserDto | null;
  allowOwnerRoles: boolean;
  onClose: () => void;
  onSaved: (user: OrgUserDto) => void;
};

const inputClass =
  "w-full rounded-xl border border-gulio-border bg-white px-3.5 py-2.5 text-sm text-gulio-text outline-none transition placeholder:text-gulio-muted/70 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

const btnSecondary =
  "min-h-10 min-w-[96px] rounded-md border-2 border-slate-200 bg-white font-semibold text-gulio-text shadow-sm transition-all duration-150 hover:border-slate-400 hover:bg-slate-50";

const btnPrimary =
  "min-h-10 min-w-[112px] rounded-md border-2 border-teal-700 bg-teal-600 font-semibold text-white shadow-sm transition-all duration-150 hover:border-teal-800 hover:bg-teal-700 hover:shadow-md";

const ROLE_OPTIONS: Array<{
  code: AssignableRoleCode;
  title: string;
  hint: string;
  ownerOnly: boolean;
}> = [
  {
    code: "CASHIER",
    title: "Cashier",
    hint: "POS sales, scanner, and receipts",
    ownerOnly: false,
  },
  {
    code: "MANAGER",
    title: "Manager",
    hint: "Approvals, stock, and back office",
    ownerOnly: true,
  },
  {
    code: "OWNER",
    title: "Owner",
    hint: "Full access, including employees",
    ownerOnly: true,
  },
];

function primaryRole(user?: OrgUserDto | null): AssignableRoleCode {
  if (user?.roles.includes("OWNER")) return "OWNER";
  if (user?.roles.includes("MANAGER")) return "MANAGER";
  return "CASHIER";
}

export function EmployeeFormModal({
  isOpen,
  mode,
  user,
  allowOwnerRoles,
  onClose,
  onSaved,
}: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [roleCode, setRoleCode] = useState<AssignableRoleCode>("CASHIER");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSaving(false);
    setPassword("");
    setPin("");
    if (mode === "edit" && user) {
      setFullName(user.fullName);
      setEmail(user.email);
      setRoleCode(primaryRole(user));
    } else {
      setFullName("");
      setEmail("");
      setRoleCode("CASHIER");
    }
  }, [isOpen, mode, user?.id]);

  const visibleRoles = ROLE_OPTIONS.filter(
    (role) => allowOwnerRoles || !role.ownerOnly,
  );

  async function handleSubmit() {
    const name = fullName.trim();
    const mail = email.trim().toLowerCase();
    if (!name) {
      setError("Full name is required");
      return;
    }
    if (!mail) {
      setError("Email is required");
      return;
    }
    if (mode === "create" && password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (mode === "edit" && password && password.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (pin && !/^\d{4}$/.test(pin)) {
      setError("PIN must be exactly 4 digits");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        const body: CreateUserRequest = {
          fullName: name,
          email: mail,
          password,
          roleCode,
          ...(pin ? { pin } : {}),
        };
        const created = await apiFetch<OrgUserDto>("/users", {
          method: "POST",
          body,
        });
        onSaved(created);
        onClose();
        return;
      }
      if (!user) return;
      const body: UpdateUserRequest = {
        fullName: name,
        email: mail,
        roleCode,
        ...(password ? { password } : {}),
        ...(pin ? { pin } : {}),
      };
      const updated = await apiFetch<OrgUserDto>(`/users/${user.id}`, {
        method: "PATCH",
        body,
      });
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : mode === "create"
              ? "Could not create employee"
              : "Could not save employee",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
      size="lg"
      scrollBehavior="inside"
      placement="center"
      classNames={{
        backdrop: "bg-slate-900/45 backdrop-opacity-100",
        wrapper: "overflow-hidden",
        base: "!bg-white border border-gulio-border text-gulio-text shadow-2xl",
        header: "!bg-white border-b border-gulio-border/80",
        body: "!bg-white",
        footer: "!bg-white border-t border-gulio-border/80",
      }}
    >
      <ModalContent className="!bg-white" style={{ backgroundColor: "#ffffff" }}>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1 !bg-white pb-3 pt-4">
              <span className="text-base font-bold tracking-tight text-gulio-text">
                {mode === "create" ? "New employee" : "Edit employee"}
              </span>
              <span className="text-sm font-normal text-gulio-muted">
                {mode === "create"
                  ? "Name, login, role, and optional manager PIN"
                  : "Update details, password, PIN, or role"}
              </span>
            </ModalHeader>

            <ModalBody className="gap-4 !bg-white py-4">
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-3.5 sm:grid-cols-2">
                <Field label="Full name" htmlFor="emp-name" required>
                  <input
                    id="emp-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    className={inputClass}
                    autoFocus
                  />
                </Field>
                <Field label="Email" htmlFor="emp-email" required>
                  <input
                    id="emp-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="off"
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="Password"
                  htmlFor="emp-password"
                  required={mode === "create"}
                  hint={
                    mode === "edit"
                      ? "Leave blank to keep the current password"
                      : "At least 8 characters"
                  }
                >
                  <input
                    id="emp-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="Manager PIN"
                  htmlFor="emp-pin"
                  hint={
                    mode === "edit" && user?.hasPin
                      ? "Leave blank to keep the current 4-digit PIN"
                      : "Optional 4 digits for approvals"
                  }
                >
                  <input
                    id="emp-pin"
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) =>
                      setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    autoComplete="off"
                    className={`${inputClass} tabular-nums tracking-widest`}
                    placeholder="••••"
                  />
                </Field>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gulio-muted">
                  Role
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {visibleRoles.map((role) => {
                    const active = roleCode === role.code;
                    return (
                      <button
                        key={role.code}
                        type="button"
                        onClick={() => setRoleCode(role.code)}
                        className={`rounded-xl border px-3 py-3 text-left transition ${
                          active
                            ? "border-teal-600 bg-teal-50 shadow-sm"
                            : "border-gulio-border bg-white hover:border-teal-300"
                        }`}
                      >
                        <span
                          className={`block text-sm font-semibold ${
                            active ? "text-teal-900" : "text-gulio-text"
                          }`}
                        >
                          {role.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-gulio-muted">
                          {role.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {!allowOwnerRoles ? (
                  <p className="mt-2 text-xs text-gulio-muted">
                    Only owners can assign Manager or Owner.
                  </p>
                ) : null}
              </div>
            </ModalBody>

            <ModalFooter className="justify-between gap-2.5 !bg-white py-3.5">
              <Button
                variant="bordered"
                radius="md"
                onPress={onClose}
                isDisabled={saving}
                className={btnSecondary}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                radius="md"
                onPress={() => void handleSubmit()}
                isLoading={saving}
                className={btnPrimary}
              >
                {mode === "create" ? "Create employee" : "Save changes"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold uppercase tracking-wide text-gulio-muted"
      >
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-gulio-muted">{hint}</p> : null}
    </div>
  );
}
