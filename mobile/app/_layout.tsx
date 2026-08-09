import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../lib/config";
import { AuthProvider } from "../lib/auth";
import { PortfolioProvider } from "../lib/portfolio";
import { useTheme } from "../lib/theme";

export default function RootLayout() {
  const theme = useTheme();

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PortfolioProvider>
          <StatusBar style={theme.isDark ? "light" : "dark"} />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.surface },
              headerTintColor: theme.text,
              headerTitleStyle: { fontWeight: "700" },
              contentStyle: { backgroundColor: theme.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="stock/[symbol]"
              options={{ title: "", presentation: "card" }}
            />
          </Stack>
        </PortfolioProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
