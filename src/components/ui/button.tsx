import { StyleSheet, TouchableOpacity, type ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { BorderRadius, ButtonHeight, SemanticColors } from "@/constants/theme";

type Variant = "primary" | "outline" | "danger";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  disabled,
  variant = "primary",
  style,
}: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        variantStyles[variant],
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <ThemedText
        style={styles.label}
        themeColor={variant === "primary" ? "background" : undefined}
      >
        {variant === "danger" ? (
          <ThemedText style={[styles.label, { color: SemanticColors.error }]}>
            {label}
          </ThemedText>
        ) : (
          label
        )}
      </ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: ButtonHeight,
    borderRadius: BorderRadius.large,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.4,
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: SemanticColors.primary,
  },
  outline: {
    borderWidth: 1,
    borderColor: "rgba(128, 128, 128, 0.3)",
  },
  danger: {
    // No fill — text color handles the danger styling
  },
});
