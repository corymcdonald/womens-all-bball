import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { TeamView } from "@/components/team-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { type GameWithStreak } from "@/hooks/use-games";

type Props = {
  game: GameWithStreak;
  userId?: string;
};

export function GameResultCard({ game, userId }: Props) {
  const theme = useTheme();

  // Keep teams in DB positions (team1=left, team2=right) — same as home screen
  const team1Record =
    game.winner_id === game.team1.id ? `${game.winnerStreak}-0` : undefined;
  const team2Record =
    game.winner_id === game.team2.id ? `${game.winnerStreak}-0` : undefined;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundElement }]}
    >
      <View style={styles.teamsRow}>
        <TeamView
          color={game.team1.color}
          players={game.team1.team_players}
          record={team1Record}
          highlightUserId={userId}
        />

        <ThemedText style={styles.vs}>vs</ThemedText>

        <TeamView
          color={game.team2.color}
          players={game.team2.team_players}
          record={team2Record}
          align="right"
          highlightUserId={userId}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    borderRadius: 12,
  },
  teamsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  vs: {
    fontWeight: "700",
    fontSize: 12,
    color: "#888",
    paddingHorizontal: Spacing.two,
    alignSelf: "center",
  },
});
