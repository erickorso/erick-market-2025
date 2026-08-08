import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../context/I18nContext";
import { ThemeProvider } from "../context/ThemeContext";

type Options = RenderOptions & {
  /** Initial history entries when the subject uses routing. */
  route?: string;
  withRouter?: boolean;
};

/**
 * Renders with the real i18n and theme providers rather than mocks, so tests
 * assert on the strings users actually see and the providers get exercised
 * for free. Data contexts stay mocked per test — those are the ones worth
 * controlling.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  { route = "/", withRouter = true, ...options }: Options = {},
) {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const tree = (
      <ThemeProvider>
        <I18nProvider>{children}</I18nProvider>
      </ThemeProvider>
    );
    return withRouter ? (
      <MemoryRouter initialEntries={[route]}>{tree}</MemoryRouter>
    ) : (
      tree
    );
  };

  return render(ui, { wrapper: Wrapper, ...options });
}

export * from "@testing-library/react";
