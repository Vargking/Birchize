import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  worker: { format: "es" },
  build: { chunkSizeWarningLimit: 1500 },
  server: { host: "0.0.0.0" },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
