"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

export type ToastAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
  action?: ToastAction;
};

type ToastItem = ToastInput & {
  id: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (input: ToastInput) => string;
  success: (title: string, description?: string, action?: ToastAction) => string;
  error: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<
  ToastVariant,
  { wrap: string; icon: string; Icon: typeof CheckCircle2 }
> = {
  success: {
    wrap: "border-emerald-200 bg-white text-emerald-950 shadow-lg shadow-emerald-900/10",
    icon: "text-emerald-600",
    Icon: CheckCircle2,
  },
  error: {
    wrap: "border-red-200 bg-white text-red-950 shadow-lg shadow-red-900/10",
    icon: "text-red-600",
    Icon: AlertCircle,
  },
  info: {
    wrap: "border-sky-200 bg-white text-slate-900 shadow-lg shadow-sky-900/10",
    icon: "text-sky-600",
    Icon: Info,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const variant = input.variant ?? "info";
      const durationMs = input.durationMs ?? (variant === "error" ? 7000 : 5500);

      setItems((prev) => [...prev, { ...input, id, variant }]);

      window.setTimeout(() => dismiss(id), durationMs);
      return id;
    },
    [dismiss],
  );

  const success = useCallback(
    (title: string, description?: string, action?: ToastAction) =>
      toast({ title, description, variant: "success", action }),
    [toast],
  );

  const error = useCallback(
    (title: string, description?: string) =>
      toast({ title, description, variant: "error" }),
    [toast],
  );

  const info = useCallback(
    (title: string, description?: string) =>
      toast({ title, description, variant: "info" }),
    [toast],
  );

  const value = useMemo(
    () => ({ toast, success, error, info, dismiss }),
    [toast, success, error, info, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:items-end sm:p-0"
      >
        <AnimatePresence mode="popLayout">
          {items.map((item) => {
            const styles = VARIANT_STYLES[item.variant];
            const Icon = styles.Icon;
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl border ${styles.wrap}`}
                role="status"
              >
                <div className="flex gap-3 p-4">
                  <Icon
                    className={`mt-0.5 h-5 w-5 shrink-0 ${styles.icon}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug">
                      {item.title}
                    </p>
                    {item.description ? (
                      <p className="mt-1 text-sm leading-relaxed text-gulio-muted">
                        {item.description}
                      </p>
                    ) : null}
                    {item.action ? (
                      <div className="mt-2.5">
                        {item.action.href ? (
                          <a
                            href={item.action.href}
                            className="inline-flex rounded-md border-2 border-teal-700 bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700"
                          >
                            {item.action.label}
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              item.action?.onClick?.();
                              dismiss(item.id);
                            }}
                            className="inline-flex rounded-md border-2 border-teal-700 bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700"
                          >
                            {item.action.label}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(item.id)}
                    className="shrink-0 rounded-md p-1 text-gulio-muted transition hover:bg-slate-100 hover:text-gulio-text"
                    aria-label="Dismiss"
                  >
                    <X size={16} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
