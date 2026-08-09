import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";

/**
 * Where Auth0 lands when the redirect does not come back through
 * `promptAsync`.
 *
 * The callback is `erickmarket://redirect`, and expo-router resolves any deep
 * link against the routes on disk — so without a file at this path the code
 * arrives and the user gets "Unmatched Route" with a perfectly good
 * authorization code sitting in the URL bar.
 *
 * It is not a fallback for a broken flow so much as the second of two paths
 * the OS is free to choose between: a Custom Tab may resume the activity, or
 * it may relaunch it, and only the first one resolves the original promise.
 */
export default function AuthRedirect() {
  const {
    code,
    error,
    error_description: description,
  } = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const { completeAuthCode } = useAuth();
  const theme = useTheme();
  // Derived, not stored: whether the URL is usable is a fact about the
  // params, known at render time. Only the exchange needs state.
  const badRedirect = error
    ? (description ?? error)
    : !code
      ? "The sign-in redirect carried no authorization code."
      : null;
  const [exchangeFailure, setExchangeFailure] = useState<string | null>(null);
  const failure = badRedirect ?? exchangeFailure;

  useEffect(() => {
    if (badRedirect || !code) return;
    let cancelled = false;
    void completeAuthCode(String(code)).then((ok) => {
      if (cancelled) return;
      // replace, not push: the redirect must not sit in the back stack, or
      // going back re-enters a flow whose code has already been spent.
      if (ok) router.replace("/portfolio");
      else setExchangeFailure("Could not finish signing in. Please try again.");
    });
    return () => {
      cancelled = true;
    };
  }, [code, badRedirect, completeAuthCode]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      {failure ? (
        <>
          <Text style={[styles.title, { color: theme.text }]}>
            Sign-in did not complete
          </Text>
          <Text style={[styles.detail, { color: theme.textMuted }]}>
            {failure}
          </Text>
          <Text
            style={[styles.action, { color: theme.accent }]}
            onPress={() => router.replace("/")}
          >
            Back to the market
          </Text>
        </>
      ) : (
        <>
          <ActivityIndicator color={theme.accent} size="large" />
          <Text style={[styles.detail, { color: theme.textMuted }]}>
            Finishing sign-in…
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: "700" },
  detail: { textAlign: "center", lineHeight: 20 },
  action: { fontSize: 16, fontWeight: "700", marginTop: 10 },
});
