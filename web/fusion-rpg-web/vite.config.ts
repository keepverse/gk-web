/// <reference types="vitest/config" />
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { lingui } from "@lingui/vite-plugin";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react({ babel: { plugins: ["macros"] } }),
    lingui(),
    tailwindcss()
  ],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src")
    }
  },
  server: { host: "127.0.0.1", port: 5173 },
  preview: { host: "127.0.0.1", port: 4173 },
  build: {
    outDir: "../../src/FusionRpg.Server/wwwroot",
    emptyOutDir: true
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "e2e/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: [
        "src/shell/**/*.{ts,tsx}",
        "src/contract/**/*.{ts,tsx}",
        "src/i18n/**/*.{ts,tsx}",
        "src/theme/**/*.{ts,tsx}",
        "src/ui/actor/**/*.{ts,tsx}",
        "src/stages/**/*.{ts,tsx}",
        "src/layers/**/*.{ts,tsx}",
        "src/lib/bus/**/*.{ts,tsx}",
        "src/ui/**/*.{ts,tsx}",
        "src/layouts/**/*.{ts,tsx}",
        "src/lib/cn.ts",
        "src/features/lawn/**/*.{ts,tsx}",
        "src/features/roster/rosterPhase.ts",
        "src/game/EventBus.ts",
        "src/game/iconUrl.ts",
        "src/game/gridMath.ts",
        "src/game/entities/PtrEntityRegistry.ts"
      ],
      exclude: [
        "src/lib/bus/hub.ts",
        "src/lib/bus/hub-provider.tsx",
        "src/lib/bus/index.ts",
        "src/ui/index.ts",
        "src/features/lawn/LawnPage.tsx",
        "src/features/lawn/LawnGameHost.tsx",
        "src/features/roster/RosterPage.tsx",
        "src/game/scenes/**",
        "src/game/createLawnGame.ts",
        "src/game/fx/**",
        "src/game/systems/**",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}"
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      }
    }
  }
});
