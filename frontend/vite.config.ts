/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // Em desenvolvimento o front fala com a API pela mesma origem, como em produção (nginx).
    proxy: {
      "/api": { target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8000" },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/api/schema.d.ts", "src/test/**", "src/main.tsx"],
    },
  },
});
