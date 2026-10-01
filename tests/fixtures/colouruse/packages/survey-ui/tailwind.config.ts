import type { Config } from "tailwindcss";

// Tailwind v3: the package's class names point at its own sheet's rows
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        destructive: "hsl(var(--destructive))",
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        border: "var(--border)",
        ring: "#94a3b8",
      },
    },
  },
} satisfies Config;
