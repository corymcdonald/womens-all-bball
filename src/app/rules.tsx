import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing, WebNavHeight } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const RULES = [
  {
    emoji: "📋",
    text: "When you arrive, sign in on both the registration clipboard and the app.",
  },
  { emoji: "🏀", text: "Full-court 5v5" },
  {
    emoji: "⏱️",
    text: "6-min running clock (5 min if 25+ players)",
  },
  {
    emoji: "✋",
    text: "Call your own fouls — honor system, call it loud",
  },
  {
    emoji: "🔄",
    text: "Winners stay on\n< 20 players: max 3 games\n20+ players: max 2 games",
  },
  { emoji: "🎯", text: "Made a 3? Tell the scorekeeper" },
  {
    emoji: "⚖️",
    text: "Ties: 1-min OT, then 1st basket wins (sudden death)",
  },
  {
    emoji: "📝",
    text: "If you lose, return to the table to re-sign up if you want to keep playing",
  },
  {
    emoji: "⏭️",
    text: "No future sign-ups while you're still on the court",
  },
  {
    emoji: "🚫",
    text: "No team picking/creating - first come, first serve",
  },
  {
    emoji: "👕",
    text: 'Loaner jerseys available! Put them in the "dirty" bag when you are done',
  },
];

function RuleItem({ emoji, text }: { emoji: string; text: string }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.ruleItem, { backgroundColor: theme.backgroundElement }]}
    >
      <ThemedText style={styles.emoji}>{emoji}</ThemedText>
      <ThemedText style={styles.ruleText}>{text}</ThemedText>
    </View>
  );
}

export default function RulesScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="title" style={styles.sectionTitle}>
            Format & Rules
          </ThemedText>

          {RULES.map((rule, i) => (
            <RuleItem key={i} emoji={rule.emoji} text={rule.text} />
          ))}
        </ScrollView>
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
  scrollContent: {
    padding: Spacing.three,
    paddingTop: WebNavHeight + Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  sectionTitle: {
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  ruleItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.two,
    borderRadius: 12,
    gap: Spacing.two,
  },
  emoji: {
    fontSize: 24,
    lineHeight: 30,
  },
  ruleText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
});
