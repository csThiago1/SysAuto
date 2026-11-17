import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"], // e2e/ é Playwright, não vitest
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@paddock/types": path.resolve(__dirname, "../../packages/types/src/index.ts"),
      "@paddock/car-3d/core": path.resolve(__dirname, "../../packages/car-3d/src/core.ts"),
      "@paddock/car-3d": path.resolve(__dirname, "../../packages/car-3d/src/index.ts"),
    },
  },
});
