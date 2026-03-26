import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import DraggableFlatList, {
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import { GameCard } from "@/components/game/game-card";
import { JoinSection } from "@/components/join/join-section";
import { QueueItem, type QueuePlayer } from "@/components/queue/queue-item";
import {
  Skeleton,
  SkeletonCard,
  SkeletonQueueItem,
} from "@/components/skeleton";
import { StatsBar } from "@/components/queue/stats-bar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  BorderRadius,
  SemanticColors,
  Spacing,
  WebNavHeight,
} from "@/constants/theme";
import { useJoinDeepLink } from "@/hooks/use-join-deeplink";
import { useTheme } from "@/hooks/use-theme";
import { useWaitlist } from "@/hooks/use-waitlist";
import * as api from "@/lib/api";
import { useAuthGate } from "@/lib/auth-gate-context";
import { formatWaitlistDate } from "@/lib/format-date";
import { useUser } from "@/lib/user-context";
import { addAuthorizedWaitlist } from "@/lib/user-store";

export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useUser();
  const { requireAuth } = useAuthGate();
  const isAdmin = user?.role === "admin";
  const [editMode, setEditMode] = useState(false);
  const [pendingWinner, setPendingWinner] = useState<{
    winnerColor: string;
    winnerPlayers: {
      user_id: string;
      users: { first_name: string; last_name: string };
    }[];
    winnerSide: "left" | "right";
  } | null>(null);

  const wl = useWaitlist();

  useJoinDeepLink({
    onJoined: () => wl.fetchLatestWaitlist(),
    onError: (message) => wl.setError(message),
    requireAuth,
  });

  async function handleDeclareWinner(gameId: string, winnerId: string) {
    // Capture the winning team's visual info before the mutation clears it
    if (wl.data?.activeGame) {
      const game = wl.data.activeGame;
      const winnerTeam = game.team1.id === winnerId ? game.team1 : game.team2;
      // team1 displays on left, team2 on right (DB order = display order)
      const winnerSide = game.team1.id === winnerId ? "left" : "right";
      setPendingWinner({
        winnerColor: winnerTeam.color,
        winnerPlayers: winnerTeam.team_players,
        winnerSide,
      });
    }

    await wl.declareWinner(gameId, winnerId);
  }

  // Clear pendingWinner once real data arrives (active game or staged teams),
  // preventing the flash to "Waiting for players" between states.
  useEffect(() => {
    if (
      pendingWinner &&
      !wl.mutating &&
      (wl.data?.activeGame || (wl.data?.stagedTeams?.length ?? 0) > 0)
    ) {
      setPendingWinner(null);
    }
  }, [pendingWinner, wl.mutating, wl.data?.activeGame, wl.data?.stagedTeams]);

  async function handleScanJoin(waitlistId: string, token: string) {
    try {
      await api.joinWaitlistWithToken(waitlistId, token);
      await addAuthorizedWaitlist(waitlistId);
      await wl.fetchLatestWaitlist();
    } catch (e) {
      wl.setError(e instanceof Error ? e.message : "Failed to join");
    }
  }

  const handleDragEnd = useCallback(
    async ({ data: reorderedData }: { data: QueuePlayer[] }) => {
      if (!wl.waitlistId) return;
      const playerIds = reorderedData.map((p) => p.id);
      await wl.reorder(playerIds);
    },
    [wl.waitlistId, wl.reorder],
  );

  const queue = wl.data?.queue ?? [];

  const renderDraggableItem = useCallback(
    ({ item, getIndex, drag, isActive }: RenderItemParams<QueuePlayer>) => {
      const index = getIndex() ?? 0;
      return (
        <QueueItem
          item={item}
          index={index}
          isMe={item.user_id === user?.id}
          isUpNext={!!wl.data && index < wl.data.upNextCount}
          editMode={editMode}
          isAdmin={!!isAdmin}
          drag={drag}
          isActive={isActive}
          onMarkAbsent={wl.markAbsent}
          onMarkPresent={wl.markPresent}
          onMarkLeft={wl.markLeft}
        />
      );
    },
    [
      user?.id,
      wl.data?.upNextCount,
      editMode,
      isAdmin,
      wl.markAbsent,
      wl.markPresent,
      wl.markLeft,
    ],
  );

  const renderStaticItem = useCallback(
    ({ item, index }: { item: QueuePlayer; index: number }) => (
      <QueueItem
        item={item}
        index={index}
        isMe={item.user_id === user?.id}
        isUpNext={!!wl.data && index < wl.data.upNextCount}
        editMode={false}
        isAdmin={!!isAdmin}
        onMarkAbsent={wl.markAbsent}
        onMarkPresent={wl.markPresent}
        onMarkLeft={wl.markLeft}
      />
    ),
    [
      user?.id,
      wl.data?.upNextCount,
      isAdmin,
      wl.markAbsent,
      wl.markPresent,
      wl.markLeft,
    ],
  );

  const listHeader = (
    <View style={styles.header}>
      {/* User info */}
      <View style={styles.topRow}>
        <ThemedText type="small">
          {user
            ? `${user.first_name} ${user.last_name}${isAdmin ? " (Staff)" : ""}`
            : " "}
        </ThemedText>
        {!user && (
          <TouchableOpacity onPress={() => requireAuth(() => {})}>
            <ThemedText type="small" style={styles.signInLink}>
              Sign In
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* Date */}
      {wl.loading ? (
        <Skeleton width={160} height={32} borderRadius={6} />
      ) : (
        <ThemedText type="subtitle">
          {wl.data
            ? formatWaitlistDate(wl.data.waitlist.created_at)
            : "No waitlist"}
        </ThemedText>
      )}

      {/* Stats */}
      {wl.loading ? (
        <View style={styles.skeletonStats}>
          <Skeleton width={50} height={32} />
          <Skeleton width={50} height={32} />
          <Skeleton width={50} height={32} />
          <Skeleton width={50} height={32} />
        </View>
      ) : wl.data ? (
        <StatsBar
          waitlist={wl.data.waitlist}
          queueCount={wl.data.queue.length}
          playingCount={wl.data.playing.length}
        />
      ) : null}

      {/* Game area: unified card for staged, live, and transition states */}
      {wl.loading ? (
        <SkeletonCard />
      ) : wl.data?.activeGame ||
        (wl.data?.stagedTeams?.length ?? 0) > 0 ||
        pendingWinner ? (
        <GameCard
          activeGame={wl.data?.activeGame}
          streak={wl.data?.waitlist.current_streak}
          streakTeamId={wl.data?.streakTeamId}
          stagedTeams={wl.data?.stagedTeams}
          pendingWinner={pendingWinner}
          isAdmin={!!isAdmin}
          onDeclareWinner={handleDeclareWinner}
          onUpdateColor={wl.updateTeamColor}
        />
      ) : wl.data ? (
        <View
          style={[styles.noGame, { backgroundColor: theme.backgroundElement }]}
        >
          <ThemedText themeColor="textSecondary">
            Waiting for players to join
          </ThemedText>
        </View>
      ) : null}

      {/* Queue header */}
      <View style={styles.sectionHeader}>
        <ThemedText type="smallBold" style={styles.sectionLabel}>
          Up Next
        </ThemedText>
        <View style={styles.sectionHeaderRight}>
          {wl.data && (
            <ThemedText type="small" themeColor="textSecondary">
              Next {wl.data.upNextCount}
            </ThemedText>
          )}
          {isAdmin && (
            <TouchableOpacity onPress={() => setEditMode(!editMode)}>
              <ThemedText type="small" style={styles.editButton}>
                {editMode ? "Done" : "Edit"}
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Queue skeleton during initial load */}
      {wl.loading && (
        <View style={styles.skeletonQueue}>
          <SkeletonQueueItem />
          <SkeletonQueueItem />
          <SkeletonQueueItem />
          <SkeletonQueueItem />
          <SkeletonQueueItem />
        </View>
      )}
    </View>
  );

  const listFooter = (
    <View style={styles.footer}>
      {wl.error ? (
        <ThemedText style={styles.error}>{wl.error}</ThemedText>
      ) : null}

      {!wl.isInQueue && !wl.isPlaying && (
        <JoinSection
          isAuthorized={wl.isAuthorized}
          onQuickJoin={wl.quickJoin}
          onTokenJoin={wl.joinWithToken}
          onScanJoin={handleScanJoin}
          setError={wl.setError}
          requireAuth={requireAuth}
        />
      )}

      {wl.isInQueue && (
        <View style={styles.statusSection}>
          <ThemedText type="smallBold">{"You're in the queue!"}</ThemedText>
          <TouchableOpacity onPress={wl.leave}>
            <ThemedText type="small" style={{ color: SemanticColors.error }}>
              Leave Queue
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {wl.isPlaying && (
        <View style={styles.statusSection}>
          <ThemedText type="smallBold">{"You're on the court!"}</ThemedText>
        </View>
      )}
    </View>
  );

  // Edit mode: draggable list. Normal mode: regular FlatList.
  if (editMode && isAdmin) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <ThemedView style={styles.container}>
          <SafeAreaView style={styles.safeArea}>
            <DraggableFlatList
              data={queue}
              keyExtractor={(item) => item.id}
              renderItem={renderDraggableItem}
              onDragEnd={handleDragEnd}
              ListHeaderComponent={listHeader}
              ListFooterComponent={listFooter}
              contentContainerStyle={styles.list}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </SafeAreaView>
        </ThemedView>
      </GestureHandlerRootView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SafeAreaView style={styles.safeArea}>
          <FlatList
            data={queue}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={wl.refreshing}
                onRefresh={wl.onRefresh}
              />
            }
            renderItem={renderStaticItem}
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            keyboardShouldPersistTaps="handled"
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: WebNavHeight + Spacing.two,
  },
  skeletonStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: Spacing.two,
  },
  skeletonQueue: {
    gap: Spacing.one,
  },
  noGame: {
    padding: Spacing.four,
    borderRadius: BorderRadius.large,
    alignItems: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  sectionLabel: {
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  editButton: {
    color: SemanticColors.primary,
    fontWeight: "600",
  },
  signInLink: {
    color: SemanticColors.primary,
    fontWeight: "600",
  },
  separator: {
    height: Spacing.one,
  },
  footer: {
    marginTop: Spacing.four,
    gap: Spacing.three,
  },
  error: {
    color: SemanticColors.error,
    textAlign: "center",
  },
  statusSection: {
    alignItems: "center",
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: BorderRadius.large,
    backgroundColor: `${SemanticColors.primary}26`,
  },
});
