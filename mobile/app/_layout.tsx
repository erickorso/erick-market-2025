import "react-native-gesture-handler";
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../lib/config";
import { AuthProvider } from "../lib/auth";
import { PrefsProvider } from "../lib/prefs";
import { PortfolioProvider } from "../lib/portfolio";
import { useTheme } from "../lib/theme";
import AppErrorBoundary from "../components/AppErrorBoundary";

// expo-router renders this instead of a blank screen when a route throws.
// A release bundle has no redbox and no reachable console, so without it a
// startup error is indistinguishable from the app simply not working.
export { AppErrorBoundary as ErrorBoundary };

export default function RootLayout() {
  const theme = useTheme();

  return (
    <SafeAreaProvider>
      <PrefsProvider>
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
              {/* The Auth0 callback. No header: it is a hand-off, not a place
                the user chose to be. */}
              <Stack.Screen name="redirect" options={{ headerShown: false }} />
            </Stack>
          </PortfolioProvider>
        </AuthProvider>
      </PrefsProvider>
    </SafeAreaProvider>
  );
}
