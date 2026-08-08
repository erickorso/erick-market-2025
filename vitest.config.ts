import { defineConfig } from "vitest/config";

/**
 * One project, jsdom everywhere.
 *
 * Splitting node and jsdom into two projects made each of them instrument the
 * whole `coverage.include` set, so every file was reported twice — once with
 * its real numbers and once at 0% from the project that never loaded it. The
 * API and service suites are pure functions plus stubbed fetch, so they run
 * happily under jsdom and the report comes out correct.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: [
      "api/**/*.test.ts",
      "services/**/*.test.ts",
      "context/**/*.test.{ts,tsx}",
      "hooks/**/*.test.{ts,tsx}",
      "components/**/*.test.tsx",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "components/**/*.{ts,tsx}",
        "context/**/*.{ts,tsx}",
        "hooks/**/*.{ts,tsx}",
        "services/**/*.ts",
        "api/_lib/**/*.ts",
      ],
      exclude: [
        "**/*.test.*",
        // Three.js scene: no logic worth asserting, and jsdom has no WebGL.
        "components/organisms/ThreeDBackground.tsx",
      ],
    },
  },
});
