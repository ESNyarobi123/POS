"use client";

import type { InsightCard } from "./types";

const toneStyles: Record<
  InsightCard["tone"],
  { border: string; bg: string; dot: string }
> = {
  teal: {
    border: "border-teal-200",
    bg: "bg-gradient-to-br from-teal-50/80 to-white",
    dot: "bg-teal-500",
  },
  amber: {
    border: "border-amber-200",
    bg: "bg-gradient-to-br from-amber-50/80 to-white",
    dot: "bg-amber-500",
  },
  emerald: {
    border: "border-emerald-200",
    bg: "bg-gradient-to-br from-emerald-50/80 to-white",
    dot: "bg-emerald-500",
  },
  slate: {
    border: "border-gulio-border",
    bg: "bg-gulio-card",
    dot: "bg-slate-400",
  },
};

type Props = {
  cards: InsightCard[];
};

export function InsightsCards({ cards }: Props) {
  return (
    <section aria-label="Insights">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gulio-muted">
          Insights
        </h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map((card) => {
          const styles = toneStyles[card.tone];
          return (
            <article
              key={card.id}
              className={`rounded-xl border ${styles.border} ${styles.bg} p-4 shadow-sm transition hover:shadow-md`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${styles.dot}`}
                  aria-hidden
                />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gulio-muted">
                  Signal
                </span>
              </div>
              <h3 className="text-sm font-semibold leading-snug text-gulio-text">
                {card.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-gulio-muted">
                {card.body}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
