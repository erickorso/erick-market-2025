import React from "react";
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useTheme } from "../../lib/theme";

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
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Market", tabBarIcon: icon("📈") }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{ title: "Portfolio", tabBarIcon: icon("💼") }}
      />
      <Tabs.Screen
        name="league"
        options={{ title: "League", tabBarIcon: icon("🏆") }}
      />
    </Tabs>
  );
}
