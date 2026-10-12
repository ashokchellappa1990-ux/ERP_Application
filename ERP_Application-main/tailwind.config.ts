import type { Config } from "tailwindcss";

/**
 * Tailwind maps utilities onto the CSS custom properties defined in
 * src/styles/tokens.css. Every color is `var(--token)` so the theme engine
 * can swap the entire palette at runtime by changing `data-theme` on <html>
 * (or by injecting inline overrides for live color customization).
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          subtle: "var(--color-primary-subtle)",
          foreground: "var(--color-primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
          hover: "var(--color-secondary-hover)",
          subtle: "var(--color-secondary-subtle)",
          foreground: "var(--color-secondary-foreground)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          foreground: "var(--color-accent-foreground)",
        },
        success: { DEFAULT: "var(--color-success)", subtle: "var(--color-success-subtle)" },
        warning: { DEFAULT: "var(--color-warning)", subtle: "var(--color-warning-subtle)" },
        danger: { DEFAULT: "var(--color-danger)", subtle: "var(--color-danger-subtle)" },
        info: { DEFAULT: "var(--color-info)", subtle: "var(--color-info-subtle)" },

        background: "var(--color-background)",
        surface: "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",
        card: "var(--color-card)",
        menu: {
          DEFAULT: "var(--color-menu)",
          hover: "var(--color-menu-hover)",
          active: "var(--color-menu-active)",
          foreground: "var(--color-menu-foreground)",
          muted: "var(--color-menu-muted)",
        },
        border: "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
        foreground: "var(--color-text)",
        muted: "var(--color-text-muted)",
        subtle: "var(--color-text-subtle)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.75rem", { lineHeight: "1rem" }],
        xs: ["0.8125rem", { lineHeight: "1.15rem" }],
        sm: ["0.875rem", { lineHeight: "1.3rem" }],
        base: ["0.9375rem", { lineHeight: "1.5rem" }],
        md: ["1rem", { lineHeight: "1.6rem" }],
        lg: ["1.125rem", { lineHeight: "1.7rem" }],
        xl: ["1.3125rem", { lineHeight: "1.85rem" }],
        "2xl": ["1.625rem", { lineHeight: "2.1rem" }],
        "3xl": ["2rem", { lineHeight: "2.4rem" }],
        "4xl": ["2.5rem", { lineHeight: "2.85rem" }],
        "5xl": ["3.5rem", { lineHeight: "3.85rem" }],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        focus: "0 0 0 3px var(--color-primary-ring)",
      },
      spacing: {
        sidebar: "var(--sidebar-width)",
        "sidebar-collapsed": "var(--sidebar-collapsed-width)",
        topbar: "var(--topbar-height)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "slide-in": "slide-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
