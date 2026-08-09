import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePrefs, type ThemeMode } from "../lib/prefs";
import { useTheme } from "../lib/theme";

const MODES: ThemeMode[] = ["system", "light", "dark"];
const GLYPH: Record<ThemeMode, string> = {
  system: "◐",
  light: "☀",
  dark: "☾",
};

/**
 * Language and theme, in the header of every tab.
 *
 * The web puts both in the navbar; a phone has no navbar, and burying them in
 * a settings screen would make a two-tap choice a five-tap one. They are small
 * enough to live where they are used.
 */
const PrefsControls: React.FC = () => {
  const theme = useTheme();
  const { lang, toggleLang, themeMode, setThemeMode, t } = usePrefs();

  const cycleTheme = () =>
    setThemeMode(MODES[(MODES.indexOf(themeMode) + 1) % MODES.length]);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={cycleTheme}
        accessibilityRole="button"
        // The label names the current mode rather than the next one, because a
        // screen reader announcing "dark" on a light theme is a lie.
        accessibilityLabel={t(
          themeMode === "system"
            ? "themeSystem"
            : themeMode === "light"
              ? "themeLight"
              : "themeDark",
        )}
        style={[styles.button, { borderColor: theme.border }]}
      >
        <Text style={{ color: theme.text, fontSize: 15 }}>
          {GLYPH[themeMode]}
        </Text>
      </Pressable>

      <Pressable
        onPress={toggleLang}
        accessibilityRole="button"
        accessibilityLabel={t("langAria")}
        style={[styles.button, { borderColor: theme.border }]}
      >
        <Text style={{ color: theme.text, fontSize: 12, fontWeight: "700" }}>
          {lang === "en" ? "ES" : "EN"}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginRight: 12 },
  button: {
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 38,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default PrefsControls;
