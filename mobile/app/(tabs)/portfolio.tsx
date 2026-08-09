import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { money, percent, useTheme } from "../../lib/theme";
import { useAuth } from "../../lib/auth";
import { newIdempotencyKey, usePortfolio } from "../../lib/portfolio";
import type { PortfolioItem } from "../../../types";

export default function PortfolioScreen() {
  const theme = useTheme();
  const { isAuthenticated, isLoading, login, logout, configured } = useAuth();
  const { cash, positions, displayName, refresh } = usePortfolio();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  if (isLoading) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  if (!isAuthenticated) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={[styles.headline, { color: theme.text }]}>
          Sign in to trade
        </Text>
        <Text style={[styles.blurb, { color: theme.textMuted }]}>
          {configured
            ? "Trading uses a virtual $10,000 fund tied to your account. The market and the league stay open either way."
            : "This build has no Auth0 configuration, so trading is unavailable. Browsing the market and the league still works."}
        </Text>
        {configured && (
          <Pressable
            onPress={() => void login()}
            accessibilityRole="button"
            style={[styles.cta, { backgroundColor: theme.accentStrong }]}
          >
            <Text style={{ color: theme.onAccent, fontWeight: "700" }}>
              Sign in
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  const invested = positions.reduce(
    (sum, p) => sum + p.quantity * p.purchasePrice,
    0,
  );
  const equity = cash + invested;
  const pnl = equity - 10_000;

  return (
    <FlatList
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={styles.list}
      data={positions}
      keyExtractor={(p) => p.stockId}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.accent}
        />
      }
      ListHeaderComponent={
        <View
          style={[
            styles.summary,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={{ color: theme.textMuted }}>
            {displayName ?? "Your portfolio"}
          </Text>
          <Text style={[styles.equity, { color: theme.text }]}>
            {money(equity)}
          </Text>
          <Text style={{ color: pnl >= 0 ? theme.up : theme.down }}>
            {money(pnl)} · {percent((pnl / 10_000) * 100)}
          </Text>
          <Text style={{ color: theme.textMuted, marginTop: 6, fontSize: 12 }}>
            Cash {money(cash)} · Invested {money(invested)}
          </Text>
          <Pressable onPress={() => void logout()} style={styles.signOut}>
            <Text style={{ color: theme.textMuted, fontSize: 12 }}>
              Sign out
            </Text>
          </Pressable>
        </View>
      }
      ListEmptyComponent={
        <Text style={[styles.blurb, { color: theme.textMuted }]}>
          No positions yet. Buy something from the Market tab.
        </Text>
      }
      renderItem={({ item }) => <PositionRow item={item} />}
    />
  );
}

const PositionRow: React.FC<{ item: PortfolioItem }> = ({ item }) => {
  const theme = useTheme();
  const { trade, refresh } = usePortfolio();
  const [busy, setBusy] = useState(false);

  const sell = useCallback(() => {
    Alert.alert(
      `Sell ${item.symbol ?? item.company}`,
      `Sell all ${item.quantity} share(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sell",
          style: "destructive",
          onPress: async () => {
            if (busy) return;
            setBusy(true);
            const result = await trade({
              side: "sell",
              symbol: item.symbol ?? item.stockId.toUpperCase(),
              company: item.company,
              qty: item.quantity,
              idempotencyKey: newIdempotencyKey(),
            });
            setBusy(false);
            if (result.ok) await refresh();
            else Alert.alert("Not traded", result.message);
          },
        },
      ],
    );
  }, [busy, item, trade, refresh]);

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: theme.accent, fontWeight: "700" }}>
          {item.symbol ?? item.stockId.toUpperCase()}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 12 }}>
          {item.quantity} @ {money(item.purchasePrice)}
        </Text>
      </View>
      <Text style={{ color: theme.text, fontWeight: "600" }}>
        {money(item.totalCost)}
      </Text>
      <Pressable
        onPress={sell}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Sell ${item.company}`}
        style={[
          styles.sell,
          { backgroundColor: theme.danger, opacity: busy ? 0.5 : 1 },
        ]}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>
          Sell
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  headline: { fontSize: 20, fontWeight: "700" },
  blurb: { textAlign: "center", lineHeight: 20 },
  cta: {
    marginTop: 8,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  list: { padding: 16, gap: 10 },
  summary: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 6 },
  equity: { fontSize: 30, fontWeight: "700", marginVertical: 2 },
  signOut: { marginTop: 12, alignSelf: "flex-start" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  sell: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
});
