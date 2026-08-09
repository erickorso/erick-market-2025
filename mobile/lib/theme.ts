import { useColorScheme } from "react-native";

/**
 * Both palettes, because the web app was built dark-first and reusing its
 * dark-only colours on a light background is exactly what the accessibility
 * audit caught there. Same mistake, same fix, done up front this time.
 */
const dark = {
  bg: "#0f172a",
  surface: "#111827",
  surfaceAlt: "#1f2937",
  border: "#374151",
  text: "#f3f4f6",
  textMuted: "#9ca3af",
  accent: "#2dd4bf",
  accentStrong: "#14b8a6",
  up: "#34d399",
  down: "#f87171",
  danger: "#ef4444",
  onAccent: "#052e2b",
};

const light = {
  bg: "#f8fafc",
  surface: "#ffffff",
  surfaceAlt: "#f1f5f9",
  border: "#e2e8f0",
  text: "#0f172a",
  textMuted: "#475569",
  accent: "#0d9488",
  // Darker than the dark-mode accent on purpose: white text on #14b8a6
  // measures 2.48:1, which is the contrast failure the web app shipped with.
  accentStrong: "#0f766e",
  up: "#047857",
  down: "#b91c1c",
  danger: "#dc2626",
  onAccent: "#ffffff",
};

export type Palette = typeof dark;

export function useTheme(): Palette & { isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme !== "light";
  return { ...(isDark ? dark : light), isDark };
}

export const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const percent = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
