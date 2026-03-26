import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { SemanticColors } from "@/constants/theme";

type BadgeColor = keyof typeof SemanticColors;

type Props = {
  label: string;
  color: BadgeColor;
};

export function Badge({ label, color }: Props) {
  return (
    <ThemedText style={[styles.badge, { color: SemanticColors[color] }]}>
      {label}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  badge: {
    fontSize: 11,
    fontWeight: "700",
  },
});
