import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AccountSection } from "@/components/settings/account-section";
import { AdminPanel } from "@/components/settings/admin-panel";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorText } from "@/components/ui/error-text";
import { StyledTextInput } from "@/components/ui/text-input";
import { SemanticColors, Spacing, WebNavHeight } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import * as api from "@/lib/api";
import { posthog } from "@/lib/posthog";
import { useUser } from "@/lib/user-context";

export default function SettingsScreen() {
  const theme = useTheme();
  const { user, login } = useUser();
  const isAdmin = user?.role === "admin";

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [profileSaved, setProfileSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSaveProfile() {
    if (!user) return;
    setError("");
    setProfileSaved(false);
    try {
      const updated = await api.updateUser(user.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || undefined,
      });
      await login(updated);
      posthog.capture("profile_updated", {
        changed_fields: [
          firstName.trim() !== user.first_name && "first_name",
          lastName.trim() !== user.last_name && "last_name",
          email.trim() !== (user.email ?? "") && "email",
        ].filter(Boolean),
      });
      setProfileSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  }

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ThemedText themeColor="textSecondary">
            Sign in to access settings
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="subtitle">Settings</ThemedText>

          <ErrorText message={error} />

          {/* Profile */}
          <Card>
            <ThemedText type="smallBold" style={styles.sectionLabel}>
              Profile
            </ThemedText>
            <StyledTextInput
              style={{ backgroundColor: theme.background }}
              placeholder="First name"
              value={firstName}
              onChangeText={(t) => {
                setFirstName(t);
                setProfileSaved(false);
              }}
              autoCapitalize="words"
            />
            <StyledTextInput
              style={{ backgroundColor: theme.background }}
              placeholder="Last name"
              value={lastName}
              onChangeText={(t) => {
                setLastName(t);
                setProfileSaved(false);
              }}
              autoCapitalize="words"
            />
            <StyledTextInput
              style={{ backgroundColor: theme.background }}
              placeholder="Email"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setProfileSaved(false);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Button
              label={profileSaved ? "Saved!" : "Save Changes"}
              onPress={handleSaveProfile}
              style={
                profileSaved
                  ? { backgroundColor: SemanticColors.success }
                  : undefined
              }
            />
          </Card>

          {/* Admin sections */}
          {isAdmin && <AdminPanel userId={user.id} onError={setError} />}

          {/* Account (link, logout, delete) */}
          <AccountSection onError={setError} />
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: Spacing.three,
    paddingTop: WebNavHeight + Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  sectionLabel: {
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
