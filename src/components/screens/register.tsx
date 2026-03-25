import { useState } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useUser } from "@/lib/user-context";
import { registerUser } from "@/lib/api";

export default function RegisterScreen() {
  const theme = useTheme();
  const { login } = useUser();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = firstName.trim() && lastName.trim() && !submitting;

  async function handleRegister() {
    if (!canSubmit) return;
    setError("");
    setSubmitting(true);

    try {
      const user = await registerUser({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || undefined,
      });
      await login(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title" style={styles.title}>
            Join the League
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Enter your name to get started
          </ThemedText>

          <ThemedView style={styles.form}>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
              placeholder="First name"
              placeholderTextColor={theme.textSecondary}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              autoComplete="given-name"
            />
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
              placeholder="Last name"
              placeholderTextColor={theme.textSecondary}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoComplete="family-name"
            />
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
              placeholder="Phone (optional)"
              placeholderTextColor={theme.textSecondary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
          </ThemedView>

          {error ? (
            <ThemedText style={styles.error}>{error}</ThemedText>
          ) : null}

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={!canSubmit}
          >
            <ThemedText
              style={styles.buttonText}
              themeColor={canSubmit ? "background" : "textSecondary"}
            >
              {submitting ? "Joining..." : "Continue"}
            </ThemedText>
          </TouchableOpacity>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: "center",
    gap: Spacing.three,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing.three,
  },
  form: {
    gap: Spacing.two,
  },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  error: {
    color: "#ef4444",
    textAlign: "center",
  },
  button: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#3c87f7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.two,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
