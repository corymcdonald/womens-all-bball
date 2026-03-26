import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { SemanticColors } from "@/constants/theme";

type Props = {
  message?: string;
};

export function ErrorText({ message }: Props) {
  if (!message) return null;

  return <ThemedText style={styles.error}>{message}</ThemedText>;
}

const styles = StyleSheet.create({
  error: {
    color: SemanticColors.error,
    textAlign: "center",
  },
});
