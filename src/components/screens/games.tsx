import { RefreshControl, SectionList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GameResultCard } from "@/components/game/game-result-card";
import { SkeletonCard } from "@/components/skeleton";
import { Spacing, WebNavHeight } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useUser } from "@/lib/user-context";
import {
  useGames,
  type GameSection,
  type GameWithStreak,
} from "@/hooks/use-games";

function LoadingSkeleton() {
  return (
    <View style={styles.skeletonList}>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <ThemedText themeColor="textSecondary">No games yet</ThemedText>
    </View>
  );
}

export default function GamesScreen() {
  const theme = useTheme();
  const { user } = useUser();
  const { sections, loading, refreshing, onRefresh } = useGames();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <SectionList<GameWithStreak, GameSection>
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GameResultCard game={item} userId={user?.id} />
          )}
          renderSectionHeader={({ section }) => (
            <ThemedText type="subtitle" style={styles.sectionHeader}>
              {section.title}
            </ThemedText>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.textSecondary}
            />
          }
          ListHeaderComponent={
            <ThemedText type="subtitle" style={styles.pageTitle}>
              Games
            </ThemedText>
          }
          ListEmptyComponent={loading ? <LoadingSkeleton /> : <EmptyState />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          stickySectionHeadersEnabled={false}
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
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.one,
  },
  pageTitle: {
    marginBottom: Spacing.two,
    paddingTop: WebNavHeight,
  },
  sectionHeader: {
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  separator: {
    height: Spacing.two,
  },
  skeletonList: {
    gap: Spacing.two,
  },
  empty: {
    alignItems: "center",
    paddingVertical: Spacing.six,
  },
});
