import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: "/pos/",
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    outDir: "../pos",
    emptyOutDir: true,
    target: "es2020",
    sourcemap: false,
  },
  server: { port: 5174 },
});
