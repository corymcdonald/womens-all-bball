import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { COLOR_VALUES } from "@/constants/team-colors";
import { Spacing } from "@/constants/theme";
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
  isTappable,
  onSelect,
  align = "left",
}: {
  team: Team;
  isSelected: boolean;
  isTappable: boolean;
  onSelect: () => void;
  align?: "left" | "right";
}) {
  const theme = useTheme();
  const isRight = align === "right";
  const teamColor =
    COLOR_VALUES[team.color.toLowerCase()] ?? team.color.toLowerCase();

  const content = (
    <View
      style={[
        styles.teamCard,
        isSelected && styles.teamCardSelected,
        isTappable && !isSelected && styles.teamCardTappable,
        isRight && styles.teamCardRight,
      ]}
    >
      <View style={[styles.teamHeader, isRight && styles.teamHeaderRight]}>
        <View style={[styles.colorDot, { backgroundColor: teamColor }]} />
        <ThemedText type="smallBold">{team.color}</ThemedText>
      </View>

      {team.team_players.map((tp) => (
        <ThemedText
          key={tp.user_id}
          type="small"
          themeColor="textSecondary"
          style={isRight && styles.textRight}
        >
          {tp.users.first_name} {tp.users.last_name[0]}.
        </ThemedText>
      ))}

      {/* Winner / tap-to-select indicator at the bottom */}
      {isTappable && (
        <View
          style={[
            styles.selectIndicator,
            isSelected && styles.selectIndicatorSelected,
            isRight && styles.selectIndicatorRight,
          ]}
        >
          <ThemedText
            type="small"
            style={[
              styles.selectIndicatorText,
              isSelected && styles.selectIndicatorTextSelected,
            ]}
          >
            {isSelected ? "Winner" : "Tap to select"}
          </ThemedText>
        </View>
      )}
    </View>
  );

  if (isTappable) {
    return (
      <TouchableOpacity
        onPress={onSelect}
        activeOpacity={0.7}
        style={styles.teamCardTouchable}
      >
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

export function OnCourtCard({ activeGame, streak, isAdmin, onEndGame }: Props) {
  const theme = useTheme();
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleSelect(teamId: string) {
    if (confirming) return;
    setSelectedWinner(selectedWinner === teamId ? null : teamId);
  }

  async function handleDeclareWinner() {
    if (!selectedWinner || !onEndGame) return;
    setConfirming(true);
    await onEndGame(activeGame.id, selectedWinner);
    setSelectedWinner(null);
    setConfirming(false);
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundElement }]}
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

      <View style={styles.teamsRow}>
        <TeamCardView
          team={activeGame.team1}
          isSelected={selectedWinner === activeGame.team1.id}
          isTappable={isAdmin}
          onSelect={() => handleSelect(activeGame.team1.id)}
        />
        <ThemedText style={styles.vs}>vs</ThemedText>
        <TeamCardView
          team={activeGame.team2}
          isSelected={selectedWinner === activeGame.team2.id}
          isTappable={isAdmin}
          onSelect={() => handleSelect(activeGame.team2.id)}
          align="right"
        />
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.info}>
        {activeGame.game_duration_minutes} min
        {"  ·  "}
        Streak {streak}/{activeGame.max_wins}
      </ThemedText>

      {isAdmin && selectedWinner && (
        <TouchableOpacity
          style={[styles.declareButton, confirming && styles.buttonDisabled]}
          onPress={handleDeclareWinner}
          disabled={confirming}
        >
          <ThemedText style={styles.declareButtonText} themeColor="background">
            {confirming ? "Declaring..." : "Declare Winner"}
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
  teamCardTouchable: {
    flex: 1,
  },
  teamCard: {
    flex: 1,
    gap: 4,
    padding: Spacing.two,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  teamCardTappable: {
    borderColor: "rgba(128, 128, 128, 0.2)",
  },
  teamCardSelected: {
    borderColor: "#3c87f7",
  },
  teamCardRight: {
    alignItems: "flex-end",
  },
  teamHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    marginBottom: 4,
  },
  teamHeaderRight: {
    flexDirection: "row-reverse",
  },
  textRight: {
    textAlign: "right",
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  selectIndicator: {
    marginTop: Spacing.one,
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
    borderRadius: 8,
    backgroundColor: "rgba(128, 128, 128, 0.1)",
    alignSelf: "flex-start",
  },
  selectIndicatorSelected: {
    backgroundColor: "#3c87f7",
  },
  selectIndicatorRight: {
    alignSelf: "flex-end",
  },
  selectIndicatorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
  },
  selectIndicatorTextSelected: {
    color: "#fff",
  },
  vs: {
    fontWeight: "700",
    fontSize: 12,
    color: "#888",
    paddingHorizontal: Spacing.two,
    alignSelf: "center",
  },
  info: {
    textAlign: "center",
  },
  declareButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#3c87f7",
    alignItems: "center",
    justifyContent: "center",
  },
  declareButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
