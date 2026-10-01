"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import {
  SUPPLIER_PAYMENT_METHODS,
  type GoodsReceiptDto,
  type RecordSupplierPaymentRequest,
  type SupplierPaymentDto,
  type SupplierPaymentMethod,
} from "@gulio/contracts";
import { paymentMethodLabel } from "@/components/backoffice/dashboard/format";
import { ApiError, apiFetch } from "@/lib/api";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import { useToast } from "@/components/shared/Toast";

type Props = {
  isOpen: boolean;
  receipt: GoodsReceiptDto | null;
  onClose: () => void;
  onSaved: (payment: SupplierPaymentDto) => void;
};

const inputClassNames = {
  label: "text-[10px] font-semibold uppercase tracking-wider text-gulio-muted",
  inputWrapper:
    "min-h-10 rounded-lg border border-gulio-border bg-white shadow-none data-[hover=true]:border-slate-300 group-data-[focus=true]:border-teal-500",
} as const;

const btnPrimary =
  "min-h-10 min-w-[128px] rounded-md border-2 border-teal-700 bg-teal-600 font-semibold text-white shadow-sm transition-all duration-150 hover:border-teal-800 hover:bg-teal-700 data-[hover=true]:bg-teal-700";

const btnSecondary =
  "min-h-10 min-w-[96px] rounded-md border-2 border-slate-200 bg-white font-semibold text-gulio-text shadow-sm transition-all duration-150 hover:border-slate-400 hover:bg-slate-50";

function todayIsoDate(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function RecordPaymentModal({ isOpen, receipt, onClose, onSaved }: Props) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<SupplierPaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState(todayIsoDate());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pending = receipt ? Number(receipt.pendingTotal) : 0;

  useEffect(() => {
    if (!isOpen || !receipt) return;
    setAmount(receipt.pendingTotal);
    setMethod("CASH");
    setReference("");
    setNote("");
    setPaidAt(todayIsoDate());
    setError(null);
    setSaving(false);
  }, [isOpen, receipt]);

  const name = receipt?.supplierName ?? "this receipt";

  async function submit() {
    if (!receipt) return;
    if (!receipt.supplierId) {
      setError(
        "This receipt has no saved distributor, so a supplier payment cannot be recorded against it.",
      );
      return;
    }
    const amountDecimal = parseMoneyInput(amount);
    const amountNumber = Number(amountDecimal);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError("Enter a payment amount greater than zero");
      return;
    }
    if (amountNumber > pending + 0.0001) {
      setError(`Amount cannot exceed the outstanding balance of ${formatMoney(receipt.pendingTotal)}`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body: RecordSupplierPaymentRequest = {
        supplierId: receipt.supplierId,
        receiptId: receipt.id,
        amount: amountDecimal,
        method,
        reference: reference.trim() || null,
        note: note.trim() || null,
        paidAt: paidAt ? new Date(`${paidAt}T12:00:00`).toISOString() : undefined,
      };
      const payment = await apiFetch<SupplierPaymentDto>("/purchasing/payments", {
        method: "POST",
        body,
      });
      toast.success(
        "Payment recorded",
        `${formatMoney(payment.amount)} paid to ${name} via ${paymentMethodLabel(payment.method)}.`,
      );
      onSaved(payment);
      onClose();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not record the payment",
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
        base: "!bg-white border border-gulio-border text-gulio-text shadow-2xl",
        header: "!bg-white border-b border-gulio-border/80",
        body: "!bg-white",
        footer: "!bg-white border-t border-gulio-border/80",
      }}
    >
      <ModalContent className="!bg-white" style={{ backgroundColor: "#ffffff" }}>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-0.5 !bg-white pb-3 pt-4">
              <span className="text-base font-bold tracking-tight">
                Record supplier payment
              </span>
              <span className="text-sm font-normal text-gulio-muted">
                {receipt?.invoiceNumber
                  ? `Invoice ${receipt.invoiceNumber} · ${name}`
                  : name}
              </span>
            </ModalHeader>

            <ModalBody className="gap-4 !bg-white py-4">
              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
                >
                  {error}
                </div>
              ) : null}

              <div className="grid gap-2 rounded-xl border border-gulio-border bg-gulio-bg/60 px-3.5 py-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                    Receipt total
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums text-gulio-text">
                    {formatMoney(receipt?.total)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                    Already paid
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums text-emerald-700">
                    {formatMoney(receipt?.paidTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gulio-muted">
                    Outstanding
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums text-amber-700">
                    {formatMoney(receipt?.pendingTotal)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  isRequired
                  size="sm"
                  label="Amount"
                  inputMode="decimal"
                  value={amount}
                  onValueChange={setAmount}
                  classNames={inputClassNames}
                />
                <Select
                  size="sm"
                  label="Method"
                  selectedKeys={new Set([method])}
                  onSelectionChange={(keys) => {
                    if (keys === "all") return;
                    const first = Array.from(keys)[0];
                    if (first != null) setMethod(String(first) as SupplierPaymentMethod);
                  }}
                  classNames={inputClassNames}
                >
                  {SUPPLIER_PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m}>{paymentMethodLabel(m)}</SelectItem>
                  ))}
                </Select>
                <Input
                  size="sm"
                  label="Reference"
                  placeholder="Txn / cheque no."
                  value={reference}
                  onValueChange={setReference}
                  classNames={inputClassNames}
                />
                <Input
                  size="sm"
                  type="date"
                  label="Paid on"
                  value={paidAt}
                  onValueChange={setPaidAt}
                  classNames={inputClassNames}
                />
              </div>

              <p className="text-xs text-gulio-muted">
                Prefilled with the full outstanding balance — edit it to record a
                partial payment.
              </p>

              <Textarea
                size="sm"
                minRows={2}
                label="Note"
                placeholder="Optional note for the audit trail"
                value={note}
                onValueChange={setNote}
                classNames={inputClassNames}
              />
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
                onPress={() => void submit()}
                isLoading={saving}
                isDisabled={!receipt?.supplierId || pending <= 0}
                className={btnPrimary}
              >
                Record payment
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
