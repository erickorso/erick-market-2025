import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fetchLeagueBoard } from "../../../services/portfolioApi";
import { money, percent, useTheme } from "../../lib/theme";
import { usePrefs } from "../../lib/prefs";
import { usePortfolio } from "../../lib/portfolio";

type Entry = {
  playerId: string;
  name: string;
  equity: number;
  pnlPercent: number;
};

export default function LeagueScreen() {
  const theme = useTheme();
  const { t } = usePrefs();
  const { displayName } = usePortfolio();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const board = await fetchLeagueBoard();
      // Coerced because these render through toFixed: a field the API ever
      // omits would take the screen down rather than show a blank.
      setEntries(
        board.entries.map((e) => ({
          playerId: e.playerId,
          name: e.name,
          equity: Number(e.equity) || 0,
          pnlPercent: Number(e.pnlPercent) || 0,
        })),
      );
      setMonth(board.month);
    } catch {
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={styles.list}
      data={entries}
      keyExtractor={(e) => e.playerId}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.accent}
        />
      }
      ListHeaderComponent={
        <Text style={[styles.caption, { color: theme.textMuted }]}>
          {month ? t("monthRanked", { month }) : t("rankedByEquity")}
        </Text>
      }
      ListEmptyComponent={
        <Text style={[styles.caption, { color: theme.textMuted }]}>
          {t("noScoresMonth")}
        </Text>
      }
      renderItem={({ item, index }) => {
        const mine = displayName != null && item.name === displayName;
        return (
          <View
            style={[
              styles.row,
              {
                backgroundColor: theme.surface,
                borderColor: mine ? theme.accent : theme.border,
              },
            ]}
          >
            <Text style={[styles.rank, { color: theme.textMuted }]}>
              {index + 1}
            </Text>
            <Text style={{ flex: 1, color: theme.text, fontWeight: "600" }}>
              {item.name}
            </Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: theme.text }}>{money(item.equity)}</Text>
              <Text
                style={{
                  color: item.pnlPercent >= 0 ? theme.up : theme.down,
                  fontSize: 12,
                }}
              >
                {percent(item.pnlPercent)}
              </Text>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 10 },
  caption: { fontSize: 12, marginBottom: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  rank: { width: 22, fontWeight: "700" },
});
