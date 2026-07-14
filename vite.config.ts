/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Served from https://chessbox12.github.io/dayscore/ — keep in sync with the repo name.
  base: "/dayscore/",
  plugins: [react()],
  server: { port: 5173 },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
