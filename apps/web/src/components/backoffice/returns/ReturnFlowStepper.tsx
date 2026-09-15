type Step = {
  id: 1 | 2 | 3;
  label: string;
  hint: string;
};

const STEPS: Step[] = [
  { id: 1, label: "Lookup", hint: "Find receipt" },
  { id: 2, label: "Select", hint: "Lines & IMEI" },
  { id: 3, label: "Confirm", hint: "Refund" },
];

type Props = {
  /** Highest completed step (0 = none). Active = current. */
  current: 1 | 2 | 3;
};

export function ReturnFlowStepper({ current }: Props) {
  return (
    <nav
      aria-label="Return steps"
      className="rounded-xl border border-gulio-border bg-gulio-card px-3 py-3 shadow-sm sm:px-4"
    >
      <ol className="flex items-stretch gap-1 sm:gap-2">
        {STEPS.map((step, index) => {
          const done = step.id < current;
          const active = step.id === current;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
              <div
                className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 sm:px-3 ${
                  active
                    ? "bg-teal-50 ring-1 ring-teal-200"
                    : done
                      ? "bg-slate-50"
                      : ""
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                    active
                      ? "bg-teal-600 text-white"
                      : done
                        ? "bg-teal-100 text-teal-800"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {done ? "✓" : step.id}
                </span>
                <div className="min-w-0">
                  <p
                    className={`truncate text-sm font-semibold ${
                      active || done ? "text-gulio-text" : "text-gulio-muted"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="hidden truncate text-[11px] text-gulio-muted sm:block">
                    {step.hint}
                  </p>
                </div>
              </div>
              {index < STEPS.length - 1 ? (
                <span
                  className={`hidden h-px w-4 shrink-0 sm:block ${
                    done ? "bg-teal-300" : "bg-gulio-border"
                  }`}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
