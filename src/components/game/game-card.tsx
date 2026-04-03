import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { SwapSheet } from "@/components/game/swap-sheet";
import { TeamView, styles as teamStyles } from "@/components/game/team-view";
import { Skeleton } from "@/components/skeleton";
import { ThemedText } from "@/components/themed-text";
import { SemanticColors, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { ActiveGame, StagedTeam, TeamPlayer } from "@/lib/types";

type QueuePlayer = {
  id: string;
  user_id: string;
  status: string;
  users: { id: string; first_name: string; last_name: string };
};

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
  queue?: QueuePlayer[];
  onDeclareWinner?: (gameId: string, winnerId: string) => void;
  onUpdateColor?: (teamId: string, color: string) => void;
  onSwapPlayer?: (
    teamId: string,
    userId: string,
    replacementUserId?: string,
  ) => void;
  mutating?: boolean;
  maxWins?: number;
  gameDuration?: number;
};

// ─── Skeleton ───

function SkeletonTeam({ align = "left" }: { align?: "left" | "right" }) {
  const isRight = align === "right";
  return (
    <View style={[teamStyles.teamCard, isRight && teamStyles.teamCardRight]}>
      <Skeleton
        width={80}
        height={14}
        style={isRight ? { alignSelf: "flex-end" } : undefined}
      />
      {[90, 70, 80, 85, 75].map((w, i) => (
        <Skeleton
          key={i}
          width={`${w}%`}
          height={12}
          style={isRight ? { alignSelf: "flex-end" } : undefined}
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
  queue = [],
  onDeclareWinner,
  onUpdateColor,
  onSwapPlayer,
  mutating,
  maxWins,
  gameDuration,
}: Props) {
  const theme = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [swapTarget, setSwapTarget] = useState<{
    teamId: string;
    userId: string;
    playerName: string;
  } | null>(null);

  async function handleDeclareWinner(teamId: string) {
    if (!onDeclareWinner || !activeGame || confirming) return;
    setConfirming(true);
    await onDeclareWinner(activeGame.id, teamId);
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

  function renderTeam(
    team: { id: string; color: string; players: TeamPlayer[] },
    opts: { record?: string; align?: "left" | "right" },
  ) {
    return (
      <TeamView
        color={team.color}
        players={team.players}
        record={opts.record}
        align={opts.align}
        isAdmin={isAdmin && !isTransitioning}
        showWinnerButton={isAdmin && isLive}
        confirming={confirming}
        mutating={mutating}
        onDeclareWinner={() => handleDeclareWinner(team.id)}
        onPlayerTap={
          onSwapPlayer
            ? (uid, name) =>
                setSwapTarget({ teamId: team.id, userId: uid, playerName: name })
            : undefined
        }
        onUpdateColor={
          onUpdateColor ? (c) => onUpdateColor(team.id, c) : undefined
        }
      />
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundElement }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ThemedText type="smallBold" style={styles.label}>
            {label}
          </ThemedText>
          {!isTransitioning && gameDuration && maxWins && (
            <ThemedText type="small" themeColor="textSecondary">
              {gameDuration}min · Win {maxWins} to stay
            </ThemedText>
          )}
        </View>
        {isLive && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <ThemedText type="small" style={styles.liveText}>
              LIVE
            </ThemedText>
          </View>
        )}
      </View>

      {/* Teams row */}
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
          renderTeam(leftTeam, { record: leftRecord })
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
          renderTeam(rightTeam, { record: rightRecord, align: "right" })
        ) : (
          <SkeletonTeam align="right" />
        )}
      </View>

      {/* Swap player sheet */}
      {swapTarget && onSwapPlayer && (
        <SwapSheet
          visible
          playerName={swapTarget.playerName}
          teamId={swapTarget.teamId}
          userId={swapTarget.userId}
          queue={queue}
          onSwap={onSwapPlayer}
          onClose={() => setSwapTarget(null)}
        />
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
  headerLeft: {
    gap: 2,
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
});
