import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        gulio: {
          bg: "var(--gulio-bg)",
          card: "var(--gulio-card)",
          text: "var(--gulio-text)",
          muted: "var(--gulio-muted)",
          border: "var(--gulio-border)",
          primary: "var(--gulio-primary)",
          "primary-hover": "var(--gulio-primary-hover)",
          success: "var(--gulio-success)",
          warn: "var(--gulio-warn)",
          error: "var(--gulio-error)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      fontSize: {
        /* 40px bold — CSS .text-cart-total mirrors this via --gulio-cart-total */
        "cart-total": [
          "var(--gulio-cart-total)",
          { lineHeight: "1.1", fontWeight: "700" },
        ],
      },
      borderRadius: {
        gulio: "var(--gulio-radius)",
      },
      spacing: {
        touch: "var(--gulio-touch-min)",
      },
      minHeight: {
        touch: "var(--gulio-touch-min)",
      },
      minWidth: {
        touch: "var(--gulio-touch-min)",
      },
    },
  },
  plugins: [],
};

export default config;
