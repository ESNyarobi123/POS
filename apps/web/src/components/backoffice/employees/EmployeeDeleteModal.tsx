"use client";

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { TriangleAlert } from "lucide-react";

type Props = {
  employeeName: string;
  isOpen: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function EmployeeDeleteModal({
  employeeName,
  isOpen,
  busy = false,
  error,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      placement="center"
      size="md"
      classNames={{
        backdrop: "bg-slate-900/50 backdrop-opacity-100",
        base: "!bg-white border border-gulio-border text-gulio-text shadow-2xl",
        header: "!bg-white border-b border-gulio-border",
        body: "!bg-white",
        footer: "!bg-white border-t border-gulio-border",
      }}
    >
      <ModalContent className="!bg-white" style={{ backgroundColor: "#ffffff" }}>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1 !bg-white">
              <span className="text-lg font-bold text-gulio-text">
                Delete employee?
              </span>
              <span className="text-sm font-normal text-gulio-muted">
                They will no longer be able to sign in
              </span>
            </ModalHeader>
            <ModalBody className="gap-4 !bg-white py-5">
              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <TriangleAlert
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                  aria-hidden
                />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-amber-950">
                    {employeeName || "This employee"}
                  </p>
                  <p className="text-amber-900/90">
                    The account is removed from Employees and cannot log in.
                    Past sales stay on the books — we never hard-delete history.
                  </p>
                </div>
              </div>
              {error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </p>
              ) : null}
            </ModalBody>
            <ModalFooter className="!bg-white">
              <Button
                variant="bordered"
                radius="lg"
                onPress={onClose}
                isDisabled={busy}
                className="min-h-10 min-w-[100px] font-semibold"
              >
                Cancel
              </Button>
              <Button
                color="danger"
                radius="lg"
                onPress={onConfirm}
                isLoading={busy}
                className="min-h-10 min-w-[100px] font-semibold"
              >
                Delete
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
