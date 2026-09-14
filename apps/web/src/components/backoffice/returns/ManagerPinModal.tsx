"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { formatMoney } from "@/lib/money";

const PIN_LEN = 4;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

type Props = {
  isOpen: boolean;
  amount: number;
  cashierNeedsManager: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (pin: string) => void;
};

export function ManagerPinModal({
  isOpen,
  amount,
  cashierNeedsManager,
  submitting,
  error,
  onClose,
  onConfirm,
}: Props) {
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setPin("");
  }, [isOpen]);

  function pushDigit(d: string) {
    setPin((prev) => (prev.length >= PIN_LEN ? prev : `${prev}${d}`));
  }

  function submit() {
    if (pin.length !== PIN_LEN || submitting) return;
    onConfirm(pin);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      size="sm"
      hideCloseButton={submitting}
      isDismissable={!submitting}
    >
      <ModalContent className="!bg-white" style={{ backgroundColor: "#ffffff" }}>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1 !bg-white pb-2 pt-5">
              <p className="text-lg font-bold text-gulio-text">Manager PIN</p>
              <p className="text-sm font-normal text-gulio-muted">
                {cashierNeedsManager
                  ? "Ask Owner or Manager to enter their PIN to approve this refund."
                  : "Confirm this large refund with your manager PIN."}
              </p>
            </ModalHeader>
            <ModalBody className="gap-4 !bg-white py-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                  Refund above TZS 500,000
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-amber-950">
                  {formatMoney(amount)}
                </p>
              </div>

              <div className="flex justify-center gap-2.5" aria-hidden>
                {Array.from({ length: PIN_LEN }).map((_, i) => (
                  <span
                    key={i}
                    className={`flex h-12 w-11 items-center justify-center rounded-xl border-2 text-lg font-bold ${
                      pin.length > i
                        ? "border-teal-600 bg-teal-50 text-teal-800"
                        : "border-gulio-border bg-gulio-bg text-transparent"
                    }`}
                  >
                    {pin.length > i ? "•" : "0"}
                  </span>
                ))}
              </div>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={pin}
                maxLength={PIN_LEN}
                aria-label="Manager PIN"
                className="sr-only"
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LEN))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
              />

              <div className="grid grid-cols-3 gap-2">
                {KEYS.map((key, i) => {
                  if (key === "") {
                    return <span key={`empty-${i}`} />;
                  }
                  if (key === "del") {
                    return (
                      <button
                        key="del"
                        type="button"
                        onClick={() => setPin((p) => p.slice(0, -1))}
                        className="min-h-touch rounded-xl border border-gulio-border bg-white text-sm font-semibold text-gulio-muted transition hover:bg-gulio-bg"
                      >
                        Delete
                      </button>
                    );
                  }
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => pushDigit(key)}
                      className="min-h-touch rounded-xl border border-gulio-border bg-white text-lg font-semibold tabular-nums text-gulio-text shadow-sm transition hover:border-teal-300 hover:bg-teal-50 active:scale-[0.98]"
                    >
                      {key}
                    </button>
                  );
                })}
              </div>

              {error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}
            </ModalBody>
            <ModalFooter className="!bg-white pb-5">
              <Button
                variant="bordered"
                className="min-h-10 rounded-md border-2 border-slate-200 bg-white font-semibold"
                onPress={onClose}
                isDisabled={submitting}
              >
                Cancel
              </Button>
              <Button
                className="min-h-10 rounded-md border-2 border-teal-700 bg-teal-600 font-semibold text-white"
                onPress={submit}
                isDisabled={pin.length !== PIN_LEN}
                isLoading={submitting}
              >
                Approve refund
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
