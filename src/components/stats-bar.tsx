import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import type { WaitlistData } from "@/hooks/use-waitlist";

type Props = {
  waitlist: WaitlistData["waitlist"];
  queueCount: number;
  playingCount: number;
};

export function StatsBar({ waitlist, queueCount, playingCount }: Props) {
  return (
    <View style={styles.row}>
      <Stat value={`${waitlist.game_duration_minutes}m`} label="Game" />
      <Stat
        value={`${waitlist.current_streak}/${waitlist.max_wins}`}
        label="Streak"
      />
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
