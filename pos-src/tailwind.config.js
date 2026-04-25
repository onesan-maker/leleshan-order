/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg":         "#0a0b10",   /* --bg-deep */
        "panel":      "#111319",   /* --bg-base */
        "panel-2":    "#181b24",   /* --bg-elev-1 */
        "panel-3":    "#20242f",   /* --bg-elev-2 */
        "panel-4":    "#2a2f3d",   /* --bg-elev-3 */
        "line":       "#262a36",   /* --line */
        "line-soft":  "#1d212b",   /* --line-soft */
        "text":       "#f5f1e8",   /* --text-hi (warm white) */
        "text-dim":   "#a7a89f",   /* --text-mid */
        "muted":      "#6b6e79",   /* --text-low */
        "subtle":     "#465066",
        "accent":     "#ff8a3d",   /* --accent warm ember */
        "accent-2":   "#ffb347",   /* --accent-2 amber glow */
        "accent-3":   "#c55a1a",   /* --accent-deep */
        "ready":      "#7dd67b",   /* --success */
        "pending":    "#ff5b5b",   /* --danger */
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
