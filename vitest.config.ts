import { defineConfig } from "vitest/config";

/**
 * Two projects: API/service code runs in node, everything that touches React
 * runs in jsdom with Testing Library's cleanup wired up.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "components/**/*.tsx",
        "context/**/*.ts",
        "hooks/**/*.ts",
        "services/**/*.ts",
        "api/_lib/**/*.ts",
      ],
      exclude: ["**/*.test.*", "components/organisms/ThreeDBackground.tsx"],
    },
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["api/**/*.test.ts", "services/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "dom",
          environment: "jsdom",
          setupFiles: ["./test/setup.ts"],
          include: [
            "components/**/*.test.tsx",
            "hooks/**/*.test.{ts,tsx}",
            "context/**/*.test.{ts,tsx}",
          ],
        },
      },
    ],
  },
});
