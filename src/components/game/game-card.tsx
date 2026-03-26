import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ColorPicker } from "@/components/game/color-picker";
import { TeamView, styles as teamStyles } from "@/components/game/team-view";
import { Skeleton } from "@/components/skeleton";
import { ThemedText } from "@/components/themed-text";
import { SemanticColors, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { ActiveGame, StagedTeam, TeamPlayer } from "@/lib/types";

type Props = {
  activeGame?: ActiveGame | null;
  streak?: number;
  streakTeamId?: string | null;
  stagedTeams?: StagedTeam[];
  pendingWinner?: {
    winnerColor: string;
    winnerPlayers: TeamPlayer[];
    winnerSide: "left" | "right";
  } | null;
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
  const normalizeGameTeam = (t: ActiveGame["team1"]) => ({
    id: t.id,
    color: t.color,
    players: t.team_players,
  });

  const normalizeStagedTeam = (t: StagedTeam) => ({
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
    backgroundColor: SemanticColors.success,
  },
  liveText: {
    color: SemanticColors.success,
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
    color: SemanticColors.primary,
    fontWeight: "600",
  },
  declareButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: SemanticColors.primary,
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
