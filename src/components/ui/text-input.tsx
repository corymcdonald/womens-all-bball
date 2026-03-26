import {
  StyleSheet,
  TextInput,
  type TextInputProps,
} from "react-native";

import {
  BorderRadius,
  InputHeight,
  Spacing,
} from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type Props = Omit<TextInputProps, "style"> & {
  /** Override the default style if needed */
  style?: TextInputProps["style"];
};

export function StyledTextInput({ style, ...props }: Props) {
  const theme = useTheme();

  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      {...props}
      style={[
        styles.input,
        { color: theme.text, backgroundColor: theme.backgroundElement },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: InputHeight,
    borderRadius: BorderRadius.large,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
});
