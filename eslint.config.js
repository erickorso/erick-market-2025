import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "playwright-report",
      "node_modules",
      "test-results",
    ],
  },

  // Browser code: the SPA, its hooks, contexts and services.
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // `_`-prefixed arguments are a deliberate "unused on purpose" marker.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // The codebase uses `unknown` + narrowing; `any` should be a decision.
      "@typescript-eslint/no-explicit-any": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Providers and route guards intentionally export a component alongside its
  // hook or helper — the standard React context shape. Splitting them would
  // buy nothing but a slightly finer HMR boundary.
  {
    files: [
      "context/**/*.tsx",
      "components/routing/**/*.tsx",
      "mobile/lib/**/*.tsx",
    ],
    rules: { "react-refresh/only-export-components": "off" },
  },

  // Serverless functions and the local BFF run in Node.
  {
    files: ["api/**/*.ts", "server/**/*.ts", "scripts/**/*.ts", "db/**/*.ts"],
    languageOptions: { globals: globals.node },
    rules: {
      // Structured JSON on stdout is the logging strategy here, not a leftover.
      "no-console": "off",
    },
  },

  // Tests: Vitest globals, and console spying is the point in a few places.
  {
    files: ["**/*.test.{ts,tsx}", "test/**/*.{ts,tsx}", "e2e/**/*.ts"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      "no-console": "off",
      "react-refresh/only-export-components": "off",
    },
  },

  // Config files are Node modules.
  {
    files: ["*.config.{js,ts}", "*.config.*.ts"],
    languageOptions: { globals: globals.node },
  },

  // Must stay last: turns off everything Prettier owns.
  prettier,
);
