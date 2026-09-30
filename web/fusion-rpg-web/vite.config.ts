/// <reference types="vitest/config" />
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { lingui } from "@lingui/vite-plugin";
import { coreRoot, dataRoot, workflowRoot } from "./gkRoots.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react({ babel: { plugins: ["macros"] } }),
    lingui(),
    tailwindcss()
  ],
  base: "./",
  resolve: {
    // @gk-core / @gk-data / @gk-workflow resolve through gkRoots, which walks up to the
    // workspace and honours KEEPVERSE_*_ROOT. They replace relative specifiers such as
    // `../../../../../data/tuning/x.json`, which named the monorepo root and, after the
    // split, pointed inside gk-web at a file that does not exist. tsconfig.json carries the
    // same three names so `tsc --noEmit` resolves what vite resolves.
    alias: {
      "@": path.resolve(rootDir, "src"),
      "@gk-core": coreRoot(),
      "@gk-data": dataRoot(),
      "@gk-workflow": workflowRoot()
    }
  },
  server: { host: "127.0.0.1", port: 5173 },
  preview: { host: "127.0.0.1", port: 4173 },
  build: {
    // The server serves the web with UseStaticFiles() from its own publish directory, so the
    // build output belongs to the SERVER's wwwroot - in gk-core. This string used to be
    // "@gk-core/src/FusionRpg.Server/wwwroot", correct while the web sat beside the server and
    // wrong the moment the package moved to gk-web: it resolved to gk-web/src/..., a directory
    // that does not exist, so a successful build would have delivered the web to a repository
    // the server never reads. gk-core gitignores **/wwwroot/, so the output is not committed.
    outDir: path.join(coreRoot(), "src", "FusionRpg.Server", "wwwroot"),
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
