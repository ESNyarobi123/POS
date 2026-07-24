/**
 * Gulio POS design tokens — mirror of apps/web globals.css :root.
 * Prefer CSS vars / Tailwind (`bg-gulio-*`, `pos-card`, `text-cart-total`) at runtime.
 *
 * Back Office nav accents (`boNav*`) are for `.bo-nav-icon` tiles only —
 * never recolor app chrome / page backgrounds (no purple-on-white theme).
 * Suggested mapping: teal=primary/dashboard, slate=ops/settings, sky=catalog,
 * amber=purchasing/alerts, emerald=inventory, rose=refunds/destructive (sparing).
 */
export const gulioTokens = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  primary: "#0D9488",
  primaryHover: "#0F766E",
  success: "#16A34A",
  warn: "#F59E0B",
  error: "#DC2626",
  /** Cart grand total — 40px (allowed range 36–40) */
  cartTotalPx: 40,
  /** Minimum cashier touch target */
  touchMinPx: 44,
  radiusPx: 12,
  /** Back Office sidebar widths (CSS: --bo-sidebar-*) */
  boSidebarWidthPx: 256,
  boSidebarCollapsedPx: 72,
  /** Icon-tile accents only — see globals.css `.bo-nav-icon--*` */
  boNav: {
    teal: "#0D9488",
    slate: "#475569",
    sky: "#0284C7",
    amber: "#D97706",
    emerald: "#059669",
    rose: "#E11D48",
  },
} as const;
