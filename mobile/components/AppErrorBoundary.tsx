import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";

/**
 * What a release build shows instead of nothing.
 *
 * A JS error during startup leaves a production bundle with no redbox and no
 * console anyone can reach — the app is alive, the screen is blank, and there
 * is nothing to report. Rendering the error is the difference between "it does
 * not work" and a stack trace someone can act on.
 *
 * expo-router picks this up by convention when it is re-exported from the root
 * layout as `ErrorBoundary`.
 */
export default function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Something broke on startup</Text>
      <Text style={styles.message}>{error.message}</Text>
      <ScrollView style={styles.stackBox}>
        <Text style={styles.stack}>{error.stack ?? "no stack"}</Text>
      </ScrollView>
      <Text style={styles.retry} onPress={retry}>
        Try again
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f172a", padding: 24, paddingTop: 72 },
  title: {
    color: "#f3f4f6",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  message: { color: "#f87171", fontSize: 14, marginBottom: 16 },
  stackBox: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 12,
  },
  stack: { color: "#9ca3af", fontSize: 11, fontFamily: "monospace" },
  retry: {
    color: "#2dd4bf",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 18,
    textAlign: "center",
  },
});
