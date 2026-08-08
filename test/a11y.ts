import axe, { type AxeResults, type Result } from "axe-core";
import { expect } from "vitest";

/**
 * Rules that cannot pass on a detached component in jsdom: they need a full
 * document (landmarks, a single main, page-level regions). The Playwright
 * scan in e2e/a11y.spec.ts covers those against the real pages instead.
 */
const COMPONENT_SCOPED_EXCLUSIONS = [
  "region",
  "landmark-one-main",
  "page-has-heading-one",
  "html-has-lang",
  "document-title",
  "bypass",
];

function format(violations: Result[]): string {
  return violations
    .map((v) => {
      const where = v.nodes
        .map((n) => `      ${n.html}`)
        .slice(0, 3)
        .join("\n");
      return `  [${v.impact}] ${v.id}: ${v.help}\n${where}\n      ${v.helpUrl}`;
    })
    .join("\n\n");
}

/**
 * Runs axe over a rendered container and fails with the actual violations
 * rather than a bare boolean. Colour-contrast is included: jsdom computes no
 * layout, so axe reports it as incomplete rather than passing, which keeps
 * the assertion honest instead of silently green.
 */
export async function expectNoA11yViolations(
  container: HTMLElement,
  options: { rules?: Record<string, { enabled: boolean }> } = {},
) {
  const results: AxeResults = await axe.run(container, {
    rules: {
      ...Object.fromEntries(
        COMPONENT_SCOPED_EXCLUSIONS.map((id) => [id, { enabled: false }]),
      ),
      ...options.rules,
    },
  });

  if (results.violations.length > 0) {
    throw new Error(
      `Expected no accessibility violations, found ${results.violations.length}:\n\n${format(
        results.violations,
      )}`,
    );
  }

  expect(results.violations).toHaveLength(0);
}
