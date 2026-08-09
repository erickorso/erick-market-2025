import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import {
  fetchStockDetail,
  formatMarketCap,
  type StockDetail,
} from "../../../services/detailService";
import Sparkline from "../../components/Sparkline";
import { money, percent, useTheme } from "../../lib/theme";
import { useAuth } from "../../lib/auth";
import { newIdempotencyKey, usePortfolio } from "../../lib/portfolio";

export default function StockDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const theme = useTheme();
  const navigation = useNavigation();
  const { isAuthenticated, login, configured } = useAuth();
  const { cash, trade, refresh } = usePortfolio();

  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  // One key per intention, kept across a failed attempt so a hand retry is
  // recognised as the same order rather than booked as a second one.
  const [orderKey, setOrderKey] = useState(newIdempotencyKey);
  const { width } = useWindowDimensions();

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void fetchStockDetail(String(symbol))
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    navigation.setOptions({ title: String(symbol) });
  }, [navigation, symbol]);

  // A different size is a different order.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderKey(newIdempotencyKey());
  }, [qty, symbol]);

  const total = (detail?.quote.price ?? 0) * qty;
  const canAfford = cash >= total;

  const buy = useCallback(async () => {
    if (!detail || busy) return;
    if (!isAuthenticated) {
      Alert.alert(
        "Sign in to trade",
        "Trading uses a virtual $10,000 fund tied to your account.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Sign in", onPress: () => void login() },
        ],
      );
      return;
    }
    setBusy(true);
    const result = await trade({
      side: "buy",
      symbol: detail.symbol,
      company: detail.company,
      qty,
      idempotencyKey: orderKey,
    });
    setBusy(false);
    if (result.ok) {
      setOrderKey(newIdempotencyKey());
      await refresh();
      Alert.alert("Done", `Bought ${qty} ${detail.symbol}.`);
    } else {
      Alert.alert("Not traded", result.message);
    }
  }, [detail, busy, isAuthenticated, login, trade, qty, orderKey, refresh]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.textMuted }}>
          No detail available for {String(symbol)}.
        </Text>
      </View>
    );
  }

  const up = (detail.quote.changePercent ?? 0) >= 0;

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.company, { color: theme.text }]}>
        {detail.company}
      </Text>
      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: theme.text }]}>
          {money(detail.quote.price)}
        </Text>
        <Text style={{ color: up ? theme.up : theme.down, fontSize: 16 }}>
          {percent(detail.quote.changePercent ?? 0)}
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Sparkline data={detail.chart} width={width - 64} height={140} />
        <Text style={[styles.caption, { color: theme.textMuted }]}>
          {detail.chartSource === "simulated"
            ? "Simulated history"
            : "Daily closes"}
        </Text>
      </View>

      <View style={styles.stats}>
        <Stat label="Open" value={money(detail.quote.open ?? 0)} />
        <Stat label="High" value={money(detail.quote.high ?? 0)} />
        <Stat label="Low" value={money(detail.quote.low ?? 0)} />
        <Stat
          label="Market cap"
          value={formatMarketCap(detail.profile.marketCap)}
        />
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.qtyRow}>
          <Text style={{ color: theme.textMuted }}>Quantity</Text>
          <View style={styles.stepper}>
            <Stepper
              label="−"
              onPress={() => setQty((q) => Math.max(1, q - 1))}
            />
            <Text style={[styles.qty, { color: theme.text }]}>{qty}</Text>
            <Stepper label="+" onPress={() => setQty((q) => q + 1)} />
          </View>
        </View>
        <Text style={{ color: theme.textMuted, marginTop: 8 }}>
          Total {money(total)}
          {isAuthenticated && !canAfford ? " · not enough cash" : ""}
        </Text>

        <Pressable
          onPress={buy}
          disabled={busy || (isAuthenticated && !canAfford)}
          accessibilityRole="button"
          style={[
            styles.buy,
            {
              backgroundColor:
                busy || (isAuthenticated && !canAfford)
                  ? theme.border
                  : theme.accentStrong,
            },
          ]}
        >
          <Text style={{ color: theme.onAccent, fontWeight: "700" }}>
            {busy ? "Working…" : isAuthenticated ? "Buy" : "Sign in to buy"}
          </Text>
        </Pressable>

        {!configured && (
          <Text style={[styles.caption, { color: theme.textMuted }]}>
            Auth is not configured in this build — browsing only.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
      ]}
    >
      <Text style={{ color: theme.textMuted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: theme.text, fontWeight: "600" }}>{value}</Text>
    </View>
  );
};

const Stepper: React.FC<{ label: string; onPress: () => void }> = ({
  label,
  onPress,
}) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        label === "+" ? "Increase quantity" : "Decrease quantity"
      }
      style={[styles.stepBtn, { backgroundColor: theme.surfaceAlt }]}
    >
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 14 },
  company: { fontSize: 22, fontWeight: "700" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 12 },
  price: { fontSize: 30, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 6 },
  caption: { fontSize: 11, marginTop: 4 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 100,
    gap: 2,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  qty: { fontSize: 18, fontWeight: "700", minWidth: 28, textAlign: "center" },
  buy: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
});
