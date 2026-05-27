/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e4ff",
          200: "#bcd1ff",
          300: "#8eb4ff",
          400: "#598dff",
          500: "#3366ff",
          600: "#1a44f5",
          700: "#1433e1",
          800: "#162bb6",
          900: "#182a8f",
          950: "#131b57",
        },
        surface: {
          base: "var(--color-bg-base)",
          DEFAULT: "var(--color-bg-surface)",
          elevated: "var(--color-bg-elevated)",
          hover: "var(--color-bg-hover)",
          muted: "var(--color-bg-muted)",
        },
        content: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
          inverse: "var(--color-text-inverse)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          light: "var(--color-border-light)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          bg: "var(--color-success-bg)",
        },
        error: {
          DEFAULT: "var(--color-error)",
          bg: "var(--color-error-bg)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          bg: "var(--color-warning-bg)",
        },
      },
    },
  },
  plugins: [],
};
