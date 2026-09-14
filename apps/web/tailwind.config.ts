import type { Config } from "tailwindcss";
import { heroui } from "@heroui/react";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
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
  plugins: [
    heroui({
      defaultTheme: "light",
      themes: {
        light: {
          colors: {
            background: "#F8FAFC",
            foreground: "#0F172A",
            content1: "#FFFFFF",
            content2: "#F8FAFC",
            content3: "#F1F5F9",
            content4: "#E2E8F0",
            default: {
              DEFAULT: "#E2E8F0",
              foreground: "#0F172A",
            },
            primary: {
              50: "#f0fdfa",
              100: "#ccfbf1",
              200: "#99f6e4",
              300: "#5eead4",
              400: "#2dd4bf",
              500: "#14b8a6",
              600: "#0d9488",
              700: "#0f766e",
              800: "#115e59",
              900: "#134e4a",
              DEFAULT: "#0D9488",
              foreground: "#ffffff",
            },
            focus: "#0D9488",
            success: {
              DEFAULT: "#16A34A",
              foreground: "#ffffff",
            },
            warning: {
              DEFAULT: "#F59E0B",
              foreground: "#0F172A",
            },
            danger: {
              DEFAULT: "#DC2626",
              foreground: "#ffffff",
            },
          },
        },
      },
    }),
  ],
};

export default config;
