import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const ETIQUETTE = [
  {
    emoji: "🏀",
    text: "Our priority is fun, inclusivity, and community — women, trans, non-binary hoopers are invited to play",
  },
  {
    emoji: "😊",
    text: "Our goal is to have fun, get exercise, and make friends. Community > competitiveness",
  },
  {
    emoji: "🤝",
    text: "All skill and fitness levels are welcome",
  },
  {
    emoji: "🚫",
    text: "No overly physical play — we aim to prevent injuries",
  },
  {
    emoji: "➡️",
    text: "If you're seeking highly competitive play, please check out other runs or leagues",
  },
  {
    emoji: "❤️",
    text: "Be kind and respectful to everyone, including our volunteers",
  },
  {
    emoji: "✋",
    text: "Interested in volunteering? We always appreciate help — especially with scorekeeping when you're sitting out",
  },
];

function EtiquetteItem({ emoji, text }: { emoji: string; text: string }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.item, { backgroundColor: theme.backgroundElement }]}
    >
      <ThemedText style={styles.emoji}>{emoji}</ThemedText>
      <ThemedText style={styles.itemText}>{text}</ThemedText>
    </View>
  );
}

export default function CultureScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="title" style={styles.sectionTitle}>
            Etiquette & Culture
          </ThemedText>

          {ETIQUETTE.map((item, i) => (
            <EtiquetteItem key={i} emoji={item.emoji} text={item.text} />
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
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  sectionTitle: {
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  item: {
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
  itemText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
});
