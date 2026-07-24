"use client";

type ShortcutId =
  | "F2"
  | "F4"
  | "F6"
  | "F8"
  | "F9"
  | "Ctrl+P"
  | "Esc";

export type ShortcutAction = {
  id: ShortcutId;
  label: string;
  disabled?: boolean;
  onAction: () => void;
};

type Props = {
  actions: ShortcutAction[];
  pressedId?: ShortcutId | null;
};

export function PosShortcutBar({ actions, pressedId }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5 border-t border-gulio-border bg-gulio-bg/60 px-3 py-1.5">
      {actions.map((s) => {
        const pressed = pressedId === s.id;
        return (
          <button
            key={s.id}
            type="button"
            disabled={s.disabled}
            onClick={() => {
              if (!s.disabled) s.onAction();
            }}
            className={[
              "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] transition",
              s.disabled
                ? "cursor-not-allowed text-gulio-muted/45 opacity-50"
                : "text-gulio-muted hover:bg-white hover:text-gulio-text",
              pressed && !s.disabled
                ? "bg-white text-gulio-text shadow-sm ring-1 ring-gulio-primary/40 scale-[0.97]"
                : "",
            ].join(" ")}
          >
            <kbd
              className={[
                "rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium shadow-sm",
                s.disabled
                  ? "border-gulio-border/60 bg-gulio-bg text-gulio-muted/50"
                  : "border-gulio-border bg-white text-gulio-text",
                pressed && !s.disabled ? "border-gulio-primary/50" : "",
              ].join(" ")}
            >
              {s.id}
            </kbd>
            <span>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
