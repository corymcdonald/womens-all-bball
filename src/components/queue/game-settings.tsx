import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { SemanticColors, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type Props = {
  maxWins: number;
  gameDuration: number;
  onUpdateSettings: (settings: {
    max_wins?: number;
    game_duration_minutes?: number;
  }) => void;
};

function Toggle({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: { label: string; value: number }[];
  value: number;
  onSelect: (v: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.toggle}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.options}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.option,
                { backgroundColor: theme.backgroundSelected },
                active && styles.optionActive,
              ]}
              onPress={() => onSelect(opt.value)}
              disabled={active}
            >
              <ThemedText
                type="small"
                style={[
                  styles.optionText,
                  active && styles.optionTextActive,
                ]}
              >
                {opt.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function GameSettings({
  maxWins,
  gameDuration,
  onUpdateSettings,
}: Props) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <View style={styles.container}>
        <View style={styles.summary}>
          <ThemedText type="small" themeColor="textSecondary">
            Win {maxWins} to stay · {gameDuration} min games
          </ThemedText>
        </View>
        <TouchableOpacity onPress={() => setEditing(true)}>
          <ThemedText type="small" style={styles.editButton}>
            Edit
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.editContainer}>
      <View style={styles.toggleRow}>
        <Toggle
          label="Wins to stay"
          options={[
            { label: "2", value: 2 },
            { label: "3", value: 3 },
          ]}
          value={maxWins}
          onSelect={(v) => onUpdateSettings({ max_wins: v })}
        />
        <Toggle
          label="Game length"
          options={[
            { label: "5 min", value: 5 },
            { label: "6 min", value: 6 },
          ]}
          value={gameDuration}
          onSelect={(v) => onUpdateSettings({ game_duration_minutes: v })}
        />
      </View>
      <TouchableOpacity onPress={() => setEditing(false)}>
        <ThemedText type="small" style={styles.editButton}>
          Done
        </ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
  },
  editContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  toggleRow: {
    flexDirection: "row",
    gap: Spacing.three,
  },
  toggle: {
    gap: Spacing.one,
  },
  options: {
    flexDirection: "row",
    gap: Spacing.one,
  },
  option: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: 8,
  },
  optionActive: {
    backgroundColor: SemanticColors.primary,
  },
  optionText: {
    fontWeight: "600",
  },
  optionTextActive: {
    color: "#fff",
  },
  editButton: {
    color: SemanticColors.primary,
    fontWeight: "600",
  },
});
