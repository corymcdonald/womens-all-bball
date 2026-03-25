import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { COLOR_VALUES } from "@/constants/team-colors";
import { useTheme } from "@/hooks/use-theme";
import type { WaitlistData } from "@/hooks/use-waitlist";

type Team = NonNullable<WaitlistData["activeGame"]>["team1"];

type Props = {
  activeGame: NonNullable<WaitlistData["activeGame"]>;
  streak: number;
  isAdmin: boolean;
  onEndGame?: (gameId: string, winnerId: string) => void;
};

function TeamCardView({
  team,
  isSelected,
  isAdmin,
  onSelect,
}: {
  team: Team;
  isSelected: boolean;
  isAdmin: boolean;
  onSelect: () => void;
}) {
  const content = (
    <View
      style={[
        styles.teamCard,
        isSelected && styles.teamCardSelected,
      ]}
    >
      <View style={styles.teamHeader}>
        <View
          style={[
            styles.colorDot,
            {
              backgroundColor:
                COLOR_VALUES[team.color.toLowerCase()] ??
                team.color.toLowerCase(),
            },
          ]}
        />
        <ThemedText type="smallBold">{team.color}</ThemedText>
        {isSelected && (
          <ThemedText type="small" style={styles.winnerBadge}>
            WINNER
          </ThemedText>
        )}
      </View>
      {team.team_players.map((tp) => (
        <ThemedText
          key={tp.user_id}
          type="small"
          themeColor="textSecondary"
        >
          {tp.users.first_name} {tp.users.last_name[0]}.
        </ThemedText>
      ))}
    </View>
  );

  if (isAdmin) {
    return <TouchableOpacity onPress={onSelect}>{content}</TouchableOpacity>;
  }
  return content;
}

export function OnCourtCard({
  activeGame,
  streak,
  isAdmin,
  onEndGame,
}: Props) {
  const theme = useTheme();
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleSelect(teamId: string) {
    if (confirming) return;
    setSelectedWinner(selectedWinner === teamId ? null : teamId);
  }

  async function handleEndGame() {
    if (!selectedWinner || !onEndGame) return;
    setConfirming(true);
    await onEndGame(activeGame.id, selectedWinner);
    setSelectedWinner(null);
    setConfirming(false);
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundElement },
      ]}
    >
      <View style={styles.header}>
        <ThemedText type="smallBold" style={styles.label}>
          On Court
        </ThemedText>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <ThemedText type="small" style={styles.liveText}>
            LIVE
          </ThemedText>
        </View>
      </View>

      {isAdmin && (
        <ThemedText type="small" themeColor="textSecondary">
          Tap the winning team to end the game
        </ThemedText>
      )}

      <View style={styles.teamsRow}>
        <TeamCardView
          team={activeGame.team1}
          isSelected={selectedWinner === activeGame.team1.id}
          isAdmin={isAdmin}
          onSelect={() => handleSelect(activeGame.team1.id)}
        />
        <ThemedText style={styles.vs}>vs</ThemedText>
        <TeamCardView
          team={activeGame.team2}
          isSelected={selectedWinner === activeGame.team2.id}
          isAdmin={isAdmin}
          onSelect={() => handleSelect(activeGame.team2.id)}
        />
      </View>

      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={styles.info}
      >
        {activeGame.game_duration_minutes} min
        {"  ·  "}
        Streak {streak}/{activeGame.max_wins}
      </ThemedText>

      {isAdmin && selectedWinner && (
        <TouchableOpacity
          style={[styles.endGameButton, confirming && styles.buttonDisabled]}
          onPress={handleEndGame}
          disabled={confirming}
        >
          <ThemedText style={styles.endGameText} themeColor="background">
            {confirming ? "Ending..." : "End Game"}
          </ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.two,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10b981",
  },
  liveText: {
    color: "#10b981",
    fontWeight: "700",
    fontSize: 11,
  },
  teamsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  teamCard: {
    flex: 1,
    gap: 4,
    padding: Spacing.two,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  teamCardSelected: {
    borderColor: "#3c87f7",
  },
  teamHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    marginBottom: 4,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  winnerBadge: {
    marginLeft: "auto",
    color: "#3c87f7",
    fontWeight: "700",
    fontSize: 11,
  },
  vs: {
    fontWeight: "700",
    fontSize: 12,
    color: "#888",
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.four,
  },
  info: {
    textAlign: "center",
  },
  endGameButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  endGameText: {
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
