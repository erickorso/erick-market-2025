import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTheme } from "../lib/theme";

/**
 * A leftover door, kept only so it does not dead-end.
 *
 * Auth0's SDK owns the callback now and it arrives natively, at its own URL —
 * nothing routes here on purpose any more. But a build installed before the
 * migration may still have `erickmarket://redirect` sitting in a browser
 * history or a pending intent, and landing on "Unmatched Route" is a worse
 * answer than quietly going home.
 */
export default function LegacyRedirect() {
  const theme = useTheme();

  useEffect(() => {
    router.replace("/");
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <ActivityIndicator color={theme.accent} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center" },
});
