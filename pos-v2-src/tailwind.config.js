/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg":         "#0a0d14",
        "panel":      "#121620",
        "panel-2":    "#1a2030",
        "panel-3":    "#242c40",
        "line":       "#242c40",
        "text":       "#ffffff",
        "text-dim":   "#c8cedc",
        "muted":      "#6b7489",
        "subtle":     "#465066",
        "accent":     "#f97316",
        "accent-2":   "#fb923c",
        "accent-3":   "#ea580c",
        "ready":      "#10b981",
        "pending":    "#ef4444",
        "preparing":  "#3b82f6",
      },
      fontFamily: {
        sans:  ['"Noto Sans TC"', '"PingFang TC"', "system-ui", "sans-serif"],
        serif: ['"Noto Serif TC"', "serif"],
        mono:  ['"JetBrains Mono"', "ui-monospace", '"SF Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
