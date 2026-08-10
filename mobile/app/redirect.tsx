import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { usePrefs } from "../lib/prefs";

/**
 * Where Auth0 lands, coming back from either direction.
 *
 * The callback is `erickmarket://redirect`, and expo-router resolves any deep
 * link against the routes on disk — so without a file here a successful login
 * ends in "Unmatched Route" with a perfectly good authorization code sitting
 * in the URL bar.
 *
 * Three different things arrive at this path, and telling them apart is the
 * whole job:
 *
 *  - an authorization code, when the browser handed the login back this way
 *    instead of through `promptAsync`;
 *  - `event=logout`, because Auth0 returns here after clearing its session,
 *    and a sign-out is not a sign-in that lost its code;
 *  - an `error`, which is the only one of the three that actually failed.
 */
export default function AuthRedirect() {
  const {
    code,
    error,
    error_description: description,
    event,
  } = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
    event?: string;
  }>();
  const { completeAuthCode } = useAuth();
  const theme = useTheme();
  const { t } = usePrefs();

  const signedOut = event === "logout";
  // Derived, not stored: whether the URL is usable is a fact about the params,
  // known at render time. Only the exchange needs state.
  const badRedirect =
    signedOut || code
      ? null
      : error
        ? (description ?? error)
        : "The sign-in redirect carried no authorization code.";
  const [exchangeFailure, setExchangeFailure] = useState<string | null>(null);
  const failure = badRedirect ?? exchangeFailure;

  useEffect(() => {
    if (signedOut) {
      router.replace("/");
      return;
    }
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
  }, [code, badRedirect, signedOut, completeAuthCode]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      {failure ? (
        <>
          <Text style={[styles.title, { color: theme.text }]}>
            {t("signInIncomplete")}
          </Text>
          <Text style={[styles.detail, { color: theme.textMuted }]}>
            {failure}
          </Text>
          <Text
            style={[styles.action, { color: theme.accent }]}
            onPress={() => router.replace("/")}
          >
            {t("backToMarket")}
          </Text>
        </>
      ) : (
        <>
          <ActivityIndicator color={theme.accent} size="large" />
          <Text style={[styles.detail, { color: theme.textMuted }]}>
            {signedOut ? t("signingOut") : t("finishingSignIn")}
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
