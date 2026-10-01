import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { pageMeta } from "./scripts/page-meta-plugin.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), pageMeta()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
});
