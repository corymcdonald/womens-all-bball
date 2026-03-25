import { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DraggableFlatList, {
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { OnCourtCard } from "@/components/on-court-card";
import { StatsBar } from "@/components/stats-bar";
import { QueueItem, type QueuePlayer } from "@/components/queue-item";
import { JoinSection } from "@/components/join-section";
import { StagedTeams } from "@/components/staged-teams";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useJoinDeepLink } from "@/hooks/use-join-deeplink";
import { useUser } from "@/lib/user-context";
import { useWaitlist } from "@/hooks/use-waitlist";
import { formatWaitlistDate } from "@/lib/format-date";
import { addAuthorizedWaitlist } from "@/lib/user-store";
import * as api from "@/lib/api";

export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useUser();
  const isAdmin = user?.role === "admin";
  const [editMode, setEditMode] = useState(false);

  const wl = useWaitlist();

  useJoinDeepLink({
    onJoined: () => wl.fetchLatestWaitlist(),
    onError: (message) => wl.setError(message),
  });

  async function handleEndGame(gameId: string, winnerId: string) {
    const result = await wl.endGame(gameId, winnerId);
    if (!result) return;

    if (!result.streak_maxed && wl.data?.activeGame) {
      await wl.nextGame(gameId, winnerId);
    }
  }

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
    [user?.id, wl.data?.upNextCount, editMode, isAdmin, wl.markAbsent, wl.markPresent, wl.markLeft],
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
    [user?.id, wl.data?.upNextCount, isAdmin, wl.markAbsent, wl.markPresent, wl.markLeft],
  );

  const listHeader = (
    <View style={styles.header}>
      {/* User info */}
      <View style={styles.topRow}>
        <ThemedText type="small">
          {user?.first_name} {user?.last_name}
          {isAdmin ? " (Staff)" : ""}
        </ThemedText>
      </View>

      {/* Date */}
      <ThemedText type="subtitle">
        {wl.data
          ? formatWaitlistDate(wl.data.waitlist.created_at)
          : "Loading..."}
      </ThemedText>

      {/* Stats */}
      {wl.data && (
        <StatsBar
          waitlist={wl.data.waitlist}
          queueCount={wl.data.queue.length}
          playingCount={wl.data.playing.length}
        />
      )}

      {/* On Court */}
      {wl.data?.activeGame ? (
        <OnCourtCard
          activeGame={wl.data.activeGame}
          streak={wl.data.waitlist.current_streak}
          isAdmin={!!isAdmin}
          onEndGame={handleEndGame}
        />
      ) : wl.data ? (
        <View
          style={[
            styles.noGame,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          <ThemedText themeColor="textSecondary">
            No game in progress
          </ThemedText>
        </View>
      ) : null}

      {/* Staged teams */}
      {wl.data && wl.data.stagedTeams.length > 0 && (
        <StagedTeams
          teams={wl.data.stagedTeams}
          isAdmin={!!isAdmin}
          onUpdateColor={wl.updateTeamColor}
          onStartGame={wl.startGame}
        />
      )}

      {/* Admin: form team */}
      {isAdmin && wl.data && (
        <TouchableOpacity
          style={[
            styles.formTeamButton,
            wl.data.queue.length < 5 && styles.buttonDisabled,
          ]}
          onPress={wl.formTeam}
          disabled={wl.data.queue.length < 5}
        >
          <ThemedText
            style={styles.buttonText}
            themeColor="background"
          >
            Form Team (Next 5)
          </ThemedText>
        </TouchableOpacity>
      )}

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
            <TouchableOpacity
              onPress={() => setEditMode(!editMode)}
            >
              <ThemedText type="small" style={styles.editButton}>
                {editMode ? "Done" : "Edit"}
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </View>
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
        />
      )}

      {wl.isInQueue && (
        <View style={styles.statusSection}>
          <ThemedText type="smallBold">
            You're in the queue!
          </ThemedText>
          <TouchableOpacity onPress={wl.leave}>
            <ThemedText type="small" style={{ color: "#ef4444" }}>
              Leave Queue
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {wl.isPlaying && (
        <View style={styles.statusSection}>
          <ThemedText type="smallBold">
            You're on the court!
          </ThemedText>
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
        />
      </SafeAreaView>
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
    paddingTop: Spacing.two,
  },
  noGame: {
    padding: Spacing.four,
    borderRadius: 12,
    alignItems: "center",
  },
  formTeamButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#3c87f7",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.4,
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
    color: "#3c87f7",
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
    color: "#ef4444",
    textAlign: "center",
  },
  statusSection: {
    alignItems: "center",
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: 12,
    backgroundColor: "rgba(60, 135, 247, 0.15)",
  },
});
