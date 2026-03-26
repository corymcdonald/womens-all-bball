import { StyleSheet, TouchableOpacity, View } from "react-native";

import { COLOR_VALUES, TEAM_COLORS } from "@/constants/team-colors";
import { SemanticColors, Spacing } from "@/constants/theme";

type Props = {
  currentColor: string;
  align?: "left" | "right";
  onSelect: (color: string) => void;
};

export function ColorPicker({ currentColor, align = "left", onSelect }: Props) {
  const isRight = align === "right";
  return (
    <View style={[styles.container, isRight && styles.containerRight]}>
      {TEAM_COLORS.map((color) => (
        <TouchableOpacity
          key={color}
          onPress={() => onSelect(color)}
          style={[
            styles.option,
            {
              backgroundColor:
                COLOR_VALUES[color.toLowerCase()] ?? color.toLowerCase(),
            },
            currentColor === color && styles.optionSelected,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  containerRight: {
    justifyContent: "flex-end",
  },
  option: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionSelected: {
    borderColor: SemanticColors.primary,
    borderWidth: 3,
  },
});
