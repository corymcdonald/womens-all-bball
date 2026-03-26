import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Skeleton } from "@/components/skeleton";
import {
  TeamView,
  type TeamPlayer,
  styles as teamStyles,
} from "@/components/team-view";
import { COLOR_VALUES, TEAM_COLORS } from "@/constants/team-colors";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type TeamData = {
  id: string;
  color: string;
  team_players: Array<{
    user_id: string;
    users: { id: string; first_name: string; last_name: string };
  }>;
};

type StagedTeamData = {
  id: string;
  color: string;
  players: Array<{
    user_id: string;
    users: { id: string; first_name: string; last_name: string };
  }>;
};

type Props = {
  // Active game (if any)
  activeGame?: {
    id: string;
    team1: TeamData;
    team2: TeamData;
    game_duration_minutes: number;
    max_wins: number;
  } | null;
  streak?: number;
  streakTeamId?: string | null;

  // Staged teams (if no active game)
  stagedTeams?: StagedTeamData[];

  // Transition state: winner stays in place, loser's side becomes skeleton
  pendingWinner?: {
    winnerColor: string;
    winnerPlayers: Array<{
      user_id: string;
      users: { first_name: string; last_name: string };
    }>;
    winnerSide: "left" | "right";
  } | null;

  // Admin
  isAdmin: boolean;
  onDeclareWinner?: (gameId: string, winnerId: string) => void;
  onUpdateColor?: (teamId: string, color: string) => void;
};

// ─── Skeleton & helpers ───

function SkeletonTeam({ align = "left" }: { align?: "left" | "right" }) {
  const isRight = align === "right";
  return (
    <View style={[teamStyles.teamCard, isRight && teamStyles.teamCardRight]}>
      <Skeleton
        width={80}
        height={14}
        style={isRight ? { alignSelf: "flex-end" } : undefined}
      />
      <Skeleton
        width="90%"
        height={12}
        style={isRight ? { alignSelf: "flex-end" } : undefined}
      />
      <Skeleton
        width="70%"
        height={12}
        style={isRight ? { alignSelf: "flex-end" } : undefined}
      />
      <Skeleton
        width="80%"
        height={12}
        style={isRight ? { alignSelf: "flex-end" } : undefined}
      />
      <Skeleton
        width="85%"
        height={12}
        style={isRight ? { alignSelf: "flex-end" } : undefined}
      />
      <Skeleton
        width="75%"
        height={12}
        style={isRight ? { alignSelf: "flex-end" } : undefined}
      />
    </View>
  );
}

function ColorPicker({
  currentColor,
  align = "left",
  onSelect,
}: {
  currentColor: string;
  align?: "left" | "right";
  onSelect: (color: string) => void;
}) {
  const isRight = align === "right";
  return (
    <View style={[styles.colorPicker, isRight && styles.colorPickerRight]}>
      {TEAM_COLORS.map((color) => (
        <TouchableOpacity
          key={color}
          onPress={() => onSelect(color)}
          style={[
            styles.colorOption,
            {
              backgroundColor:
                COLOR_VALUES[color.toLowerCase()] ?? color.toLowerCase(),
            },
            currentColor === color && styles.colorOptionSelected,
          ]}
        />
      ))}
    </View>
  );
}

// ─── Main component ───

export function GameCard({
  activeGame,
  streak = 0,
  streakTeamId,
  stagedTeams = [],
  pendingWinner,
  isAdmin,
  onDeclareWinner,
  onUpdateColor,
}: Props) {
  const theme = useTheme();
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  function handleSelect(teamId: string) {
    if (confirming) return;
    setSelectedWinner(selectedWinner === teamId ? null : teamId);
  }

  async function handleDeclareWinner() {
    if (!selectedWinner || !onDeclareWinner || !activeGame) return;
    setConfirming(true);
    await onDeclareWinner(activeGame.id, selectedWinner);
    setSelectedWinner(null);
    setConfirming(false);
  }

  // Normalize teams into a common shape
  const normalizeGameTeam = (t: TeamData) => ({
    id: t.id,
    color: t.color,
    players: t.team_players,
  });

  const normalizeStagedTeam = (t: StagedTeamData) => ({
    id: t.id,
    color: t.color,
    players: t.players,
  });

  // Determine what to show
  // Teams stay in their positions — no swapping between left and right.
  const isLive = !!activeGame;
  const isTransitioning = !!pendingWinner;

  let leftTeam: { id: string; color: string; players: TeamPlayer[] } | null =
    null;
  let rightTeam: { id: string; color: string; players: TeamPlayer[] } | null =
    null;
  let leftRecord: string | undefined;
  let rightRecord: string | undefined;
  let label = "";

  if (isTransitioning) {
    label = "Next Game";
  } else if (isLive) {
    leftTeam = normalizeGameTeam(activeGame.team1);
    rightTeam = normalizeGameTeam(activeGame.team2);
    label = "On Court";

    // Show the staying team's win record
    if (streak > 0 && streakTeamId) {
      const record = `${streak}-0`;
      if (streakTeamId === activeGame.team1.id) {
        leftRecord = record;
      } else if (streakTeamId === activeGame.team2.id) {
        rightRecord = record;
      }
    }
  } else if (stagedTeams.length > 0) {
    leftTeam = normalizeStagedTeam(stagedTeams[0]);
    if (stagedTeams.length > 1) {
      rightTeam = normalizeStagedTeam(stagedTeams[1]);
    }
    label = "Up Next";
  }

  if (!isLive && !isTransitioning && stagedTeams.length === 0) return null;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundElement }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="smallBold" style={styles.label}>
          {label}
        </ThemedText>
        {isLive && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <ThemedText type="small" style={styles.liveText}>
              LIVE
            </ThemedText>
          </View>
        )}
      </View>

      {/* Teams row — teams stay in their positions, never swap sides */}
      <View style={styles.teamsRow}>
        {/* Left side */}
        {isTransitioning ? (
          pendingWinner!.winnerSide === "left" ? (
            <TeamView
              color={pendingWinner!.winnerColor}
              players={pendingWinner!.winnerPlayers}
            />
          ) : (
            <SkeletonTeam />
          )
        ) : leftTeam ? (
          <>
            <TeamView
              color={leftTeam.color}
              players={leftTeam.players}
              record={leftRecord}
              isSelected={selectedWinner === leftTeam.id}
              isTappable={isAdmin && isLive}
              onTap={() => handleSelect(leftTeam!.id)}
            />
            {isAdmin &&
              !isLive &&
              editingTeamId === leftTeam.id &&
              onUpdateColor && (
                <ColorPicker
                  currentColor={leftTeam.color}
                  onSelect={(c) => {
                    onUpdateColor(leftTeam!.id, c);
                    setEditingTeamId(null);
                  }}
                />
              )}
          </>
        ) : (
          <SkeletonTeam />
        )}

        <ThemedText style={styles.vs}>vs</ThemedText>

        {/* Right side */}
        {isTransitioning ? (
          pendingWinner!.winnerSide === "right" ? (
            <TeamView
              color={pendingWinner!.winnerColor}
              players={pendingWinner!.winnerPlayers}
              align="right"
            />
          ) : (
            <SkeletonTeam align="right" />
          )
        ) : rightTeam ? (
          <>
            <TeamView
              color={rightTeam.color}
              players={rightTeam.players}
              record={rightRecord}
              align="right"
              isSelected={selectedWinner === rightTeam.id}
              isTappable={isAdmin && isLive}
              onTap={() => handleSelect(rightTeam!.id)}
            />
            {isAdmin &&
              !isLive &&
              editingTeamId === rightTeam.id &&
              onUpdateColor && (
                <ColorPicker
                  currentColor={rightTeam.color}
                  align="right"
                  onSelect={(c) => {
                    onUpdateColor(rightTeam!.id, c);
                    setEditingTeamId(null);
                  }}
                />
              )}
          </>
        ) : (
          <SkeletonTeam align="right" />
        )}
      </View>

      {/* Game info */}
      {isLive && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.info}>
          {activeGame.game_duration_minutes} min games
        </ThemedText>
      )}

      {/* Admin: color edit toggle for staged teams */}
      {isAdmin && !isLive && !isTransitioning && stagedTeams.length > 0 && (
        <View style={styles.editRow}>
          {[leftTeam, rightTeam].filter(Boolean).map((team) => (
            <TouchableOpacity
              key={team!.id}
              onPress={() =>
                setEditingTeamId(editingTeamId === team!.id ? null : team!.id)
              }
            >
              <ThemedText type="small" style={styles.editText}>
                {editingTeamId === team!.id ? "Done" : `Edit ${team!.color}`}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Declare winner button */}
      {isAdmin && isLive && selectedWinner && (
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
  editRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  editText: {
    color: "#3c87f7",
    fontWeight: "600",
  },
  colorPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  colorPickerRight: {
    justifyContent: "flex-end",
  },
  colorOption: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorOptionSelected: {
    borderColor: "#3c87f7",
    borderWidth: 3,
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
