import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link } from "expo-router";
import {
  CATEGORIES,
  fetchStocks,
  type CategoryId,
  type DataSource,
} from "../../../services/stockService";
import type { EnrichedStock } from "../../../types";
import { money, percent, useTheme } from "../../lib/theme";

const SEARCH_DEBOUNCE_MS = 350;

export default function MarketScreen() {
  const theme = useTheme();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId>("all");
  const [stocks, setStocks] = useState<EnrichedStock[]>([]);
  const [source, setSource] = useState<DataSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Typing a ticker should not fire a request per keystroke over mobile data.
  useEffect(() => {
    const id = setTimeout(() => setQuery(term), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [term]);

  const load = useCallback(async () => {
    const result = await fetchStocks({ q: query, category, offset: 0 });
    setStocks(result.stocks);
    setSource(result.source);
  }, [query, category]);

  useEffect(() => {
    let cancelled = false;
    // The standard fetch-in-an-effect shape: the state it sets lands in a
    // promise callback, not synchronously in the render pass.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <TextInput
        value={term}
        onChangeText={setTerm}
        placeholder="Search stocks…"
        placeholderTextColor={theme.textMuted}
        autoCorrect={false}
        autoCapitalize="characters"
        accessibilityLabel="Search stocks"
        style={[
          styles.search,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            color: theme.text,
          },
        ]}
      />

      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(c) => c.id}
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
        renderItem={({ item }) => {
          const active = item.id === category;
          return (
            <Pressable
              onPress={() => setCategory(item.id as CategoryId)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.accentStrong : theme.surface,
                  borderColor: active ? theme.accentStrong : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  color: active ? theme.onAccent : theme.textMuted,
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        }}
      />

      {loading ? (
        <ActivityIndicator
          color={theme.accent}
          size="large"
          style={styles.loader}
        />
      ) : (
        <FlatList
          data={stocks}
          keyExtractor={(s) => s.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accent}
            />
          }
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            source ? (
              <Text style={[styles.source, { color: theme.textMuted }]}>
                {source === "live" ? "Finnhub · live" : "Simulated prices"} ·{" "}
                {stocks.length} shown
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.textMuted }]}>
              Nothing matches that search.
            </Text>
          }
          renderItem={({ item }) => <StockRow stock={item} />}
        />
      )}
    </View>
  );
}

const StockRow: React.FC<{ stock: EnrichedStock }> = ({ stock }) => {
  const theme = useTheme();
  const change = stock.changePercent ?? 0;
  const up = change >= 0;
  const symbol = stock.symbol ?? stock.id.toUpperCase();

  return (
    <Link href={`/stock/${symbol}`} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${stock.company}, ${money(stock.price)}, ${percent(change)}`}
        style={[
          styles.row,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.rowMain}>
          <Text style={[styles.symbol, { color: theme.accent }]}>{symbol}</Text>
          <Text
            numberOfLines={1}
            style={[styles.company, { color: theme.textMuted }]}
          >
            {stock.company}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.price, { color: theme.text }]}>
            {money(stock.price)}
          </Text>
          <Text style={{ color: up ? theme.up : theme.down, fontSize: 13 }}>
            {percent(change)}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  search: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  chipRow: { flexGrow: 0, marginTop: 12 },
  chipRowContent: { paddingHorizontal: 16, gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  loader: { marginTop: 48 },
  listContent: { padding: 16, gap: 10 },
  source: { fontSize: 12, marginBottom: 6 },
  empty: { textAlign: "center", marginTop: 40 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  rowMain: { flex: 1, gap: 2 },
  rowRight: { alignItems: "flex-end", gap: 2 },
  symbol: { fontSize: 16, fontWeight: "700" },
  company: { fontSize: 12 },
  price: { fontSize: 16, fontWeight: "600" },
});
