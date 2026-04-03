import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";

type Props = {
  queueCount: number;
  playingCount: number;
  totalPlayers: number;
};

export function StatsBar({ queueCount, playingCount, totalPlayers }: Props) {
  return (
    <View style={styles.row}>
      <Stat value={`${totalPlayers}`} label="Joined" />
      <Stat value={`${queueCount}`} label="In Queue" />
      <Stat value={`${playingCount}`} label="Playing" />
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.item}>
      <ThemedText type="smallBold">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: Spacing.two,
  },
  item: {
    alignItems: "center",
    gap: 2,
  },
});
