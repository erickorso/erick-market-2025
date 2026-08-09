import React from "react";
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useTheme } from "../../lib/theme";
import { usePrefs } from "../../lib/prefs";
import PrefsControls from "../../components/PrefsControls";

/** Emoji instead of an icon font: three glyphs is not worth a dependency. */
const icon = (glyph: string) => {
  const Icon = ({ color }: { color: string }) => (
    <Text style={{ fontSize: 20, color }}>{glyph}</Text>
  );
  Icon.displayName = `TabIcon(${glyph})`;
  return Icon;
};

export default function TabsLayout() {
  const theme = useTheme();
  const { t } = usePrefs();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: "700" },
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        headerRight: () => <PrefsControls />,
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t("tabMarket"), tabBarIcon: icon("📈") }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{ title: t("tabPortfolio"), tabBarIcon: icon("💼") }}
      />
      <Tabs.Screen
        name="league"
        options={{ title: t("tabLeague"), tabBarIcon: icon("🏆") }}
      />
    </Tabs>
  );
}
