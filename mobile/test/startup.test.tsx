import React from "react";
import { Text } from "react-native";
import { render, screen, waitFor } from "@testing-library/react-native";
import { PrefsProvider, usePrefs } from "../lib/prefs";
import { AuthProvider } from "../lib/auth";
import { PortfolioProvider } from "../lib/portfolio";
import { useTheme } from "../lib/theme";
import RootLayout from "../app/_layout";

/**
 * The check none of the others could make.
 *
 * Three startup failures shipped to a device before this existed: a missing
 * native module, an unmatched deep link, and a layout consuming a context it
 * rendered itself. Typecheck, bundle and expo-doctor all passed on every one
 * of them, because none of those actually render anything.
 *
 * This does. It is not about coverage — it is the difference between "it
 * compiles" and "it starts".
 */

/** Reads everything the real screens read, so a missing provider throws here. */
const Consumer: React.FC = () => {
  const theme = useTheme();
  const { t, lang, themeMode } = usePrefs();
  return (
    <Text testID="probe">
      {t("tabMarket")}|{lang}|{themeMode}|{theme.isDark ? "dark" : "light"}
    </Text>
  );
};

/** The probe renders an array of children; this is their concatenation. */
const probeText = () =>
  ([] as unknown[]).concat(screen.getByTestId("probe").props.children).join("");

const Tree: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PrefsProvider>
    <AuthProvider>
      <PortfolioProvider>{children}</PortfolioProvider>
    </AuthProvider>
  </PrefsProvider>
);

describe("the provider tree", () => {
  it("mounts without throwing", async () => {
    render(
      <Tree>
        <Consumer />
      </Tree>,
    );
    await waitFor(() => expect(screen.getByTestId("probe")).toBeTruthy());
  });

  /**
   * The regression test for the crash this replaced. RootLayout called
   * useTheme, which reads PrefsProvider — the provider RootLayout was itself
   * rendering — so its own body ran before the context existed. Rendering the
   * real layout is the only thing that catches that coming back: a hand-built
   * provider tree in a test mirrors the fixed shape and would pass either way.
   */
  it("mounts the real root layout", () => {
    expect(() => render(<RootLayout />)).not.toThrow();
  });

  it("resolves translations rather than echoing the key back", async () => {
    render(
      <Tree>
        <Consumer />
      </Tree>,
    );
    await waitFor(() => {
      // A missing key would come back as "tabMarket", which is the failure
      // worth catching: the screen renders, just in gibberish.
      expect(probeText()).toContain("Market");
      expect(probeText()).not.toContain("tabMarket");
    });
  });

  it("starts on a real theme, not undefined", async () => {
    render(
      <Tree>
        <Consumer />
      </Tree>,
    );
    await waitFor(() => {
      const text = screen.getByTestId("probe").props.children.join("");
      expect(text).toMatch(/\|(dark|light)$/);
    });
  });
});
