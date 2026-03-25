import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { JoinQRCode } from "@/components/join-qr-code";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useUser } from "@/lib/user-context";
import { formatWaitlistDate } from "@/lib/format-date";
import * as api from "@/lib/api";
import { posthog } from "@/lib/posthog";

export default function SettingsScreen() {
  const theme = useTheme();
  const { user, login, logout } = useUser();
  const isAdmin = user?.role === "admin";

  // Profile
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [profileSaved, setProfileSaved] = useState(false);
  const [error, setError] = useState("");

  // Admin: waitlists
  const [waitlists, setWaitlists] = useState<
    Array<{ id: string; passcode: string; created_at: string }>
  >([]);

  // Admin: current admins list
  const [admins, setAdmins] = useState<
    Array<{ id: string; first_name: string; last_name: string }>
  >([]);

  // Admin: user search
  const [adminSearch, setAdminSearch] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      id: string;
      first_name: string;
      last_name: string;
      role: string;
    }>
  >([]);

  const fetchAdminData = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [waitlistData, adminData] = await Promise.all([
        api.listWaitlists(),
        api.listAdmins(),
      ]);
      setWaitlists(waitlistData);
      setAdmins(adminData);
    } catch {}
  }, [isAdmin]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  async function handleSaveProfile() {
    if (!user) return;
    setError("");
    setProfileSaved(false);
    try {
      const updated = await api.updateUser(user.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || undefined,
      });
      await login(updated);
      posthog.capture("profile_updated");
      setProfileSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  }

  async function handleDeleteAccount() {
    if (!user) return;

    const doDelete = async () => {
      try {
        await api.deleteUser(user.id);
        await logout();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete account");
      }
    };

    if (Platform.OS === "web") {
      if (
        window.confirm(
          "Are you sure? This will permanently delete your account and all your data.",
        )
      ) {
        await doDelete();
      }
    } else {
      Alert.alert(
        "Delete Account",
        "Are you sure? This will permanently delete your account and all your data.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doDelete },
        ],
      );
    }
  }

  async function handleCreateWaitlist() {
    setError("");
    try {
      await api.createWaitlist();
      posthog.capture("waitlist_created");
      await fetchAdminData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create waitlist");
    }
  }

  async function handleAdminSearch(query: string) {
    setAdminSearch(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await api.searchUsers(query.trim());
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
  }

  async function handlePromote(userId: string) {
    try {
      await api.promoteUser(userId);
      setSearchResults((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: "admin" } : u)),
      );
      // Refresh admin list
      const adminData = await api.listAdmins();
      setAdmins(adminData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to promote");
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

  const latestWaitlist = waitlists[0];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="subtitle">Settings</ThemedText>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          {/* Profile */}
          <View
            style={[
              styles.section,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <ThemedText type="smallBold" style={styles.sectionLabel}>
              Profile
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.background },
              ]}
              placeholder="First name"
              placeholderTextColor={theme.textSecondary}
              value={firstName}
              onChangeText={(t) => {
                setFirstName(t);
                setProfileSaved(false);
              }}
              autoCapitalize="words"
            />
            <TextInput
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.background },
              ]}
              placeholder="Last name"
              placeholderTextColor={theme.textSecondary}
              value={lastName}
              onChangeText={(t) => {
                setLastName(t);
                setProfileSaved(false);
              }}
              autoCapitalize="words"
            />
            <TextInput
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.background },
              ]}
              placeholder="Phone (optional)"
              placeholderTextColor={theme.textSecondary}
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                setProfileSaved(false);
              }}
              keyboardType="phone-pad"
            />
            <TouchableOpacity
              style={[styles.primaryButton, profileSaved && styles.savedButton]}
              onPress={handleSaveProfile}
            >
              <ThemedText style={styles.buttonText} themeColor="background">
                {profileSaved ? "Saved!" : "Save Changes"}
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Admin: QR Code */}
          {isAdmin && latestWaitlist && (
            <View
              style={[
                styles.section,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText type="smallBold" style={styles.sectionLabel}>
                Current Session —{" "}
                {formatWaitlistDate(latestWaitlist.created_at)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Passcode: {latestWaitlist.passcode}
              </ThemedText>
              <JoinQRCode
                waitlistId={latestWaitlist.id}
                scheme="womensallbball"
              />
            </View>
          )}

          {/* Admin: Waitlists */}
          {isAdmin && (
            <View
              style={[
                styles.section,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText type="smallBold" style={styles.sectionLabel}>
                Waitlists
              </ThemedText>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleCreateWaitlist}
              >
                <ThemedText style={styles.buttonText} themeColor="background">
                  Create New Waitlist
                </ThemedText>
              </TouchableOpacity>

              {waitlists.slice(0, 5).map((w) => (
                <View key={w.id} style={styles.listRow}>
                  <ThemedText type="small">
                    {formatWaitlistDate(w.created_at)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {w.passcode}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}

          {/* Admin: Manage Admins */}
          {isAdmin && (
            <View
              style={[
                styles.section,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText type="smallBold" style={styles.sectionLabel}>
                Admins
              </ThemedText>
              {admins.map((a) => (
                <View key={a.id} style={styles.listRow}>
                  <ThemedText type="small">
                    {a.first_name} {a.last_name}
                  </ThemedText>
                  {a.id === user?.id && (
                    <ThemedText type="small" themeColor="textSecondary">
                      You
                    </ThemedText>
                  )}
                </View>
              ))}

              <ThemedText
                type="smallBold"
                style={[styles.sectionLabel, { marginTop: Spacing.two }]}
              >
                Add Admin
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.background },
                ]}
                placeholder="Search by name..."
                placeholderTextColor={theme.textSecondary}
                value={adminSearch}
                onChangeText={handleAdminSearch}
                autoCapitalize="words"
              />
              {searchResults.map((u) => (
                <View key={u.id} style={styles.listRow}>
                  <View style={styles.listRowInfo}>
                    <ThemedText type="small">
                      {u.first_name} {u.last_name}
                    </ThemedText>
                    {u.role === "admin" && (
                      <ThemedText type="small" style={styles.adminBadge}>
                        ADMIN
                      </ThemedText>
                    )}
                  </View>
                  {u.role !== "admin" && (
                    <TouchableOpacity
                      onPress={() => handlePromote(u.id)}
                      style={styles.promoteButton}
                    >
                      <ThemedText type="small" style={styles.promoteText}>
                        Make Admin
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Account */}
          <View
            style={[
              styles.section,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <ThemedText type="smallBold" style={styles.sectionLabel}>
              Account
            </ThemedText>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => {
                posthog.capture("user_logged_out");
                logout();
              }}
            >
              <ThemedText style={styles.logoutText}>Log Out</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDeleteAccount}
            >
              <ThemedText style={styles.deleteText}>Delete Account</ThemedText>
            </TouchableOpacity>
          </View>
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
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  error: {
    color: "#ef4444",
    textAlign: "center",
  },
  section: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.two,
  },
  sectionLabel: {
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  primaryButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#3c87f7",
    alignItems: "center",
    justifyContent: "center",
  },
  savedButton: {
    backgroundColor: "#10b981",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.one,
  },
  listRowInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  adminBadge: {
    color: "#3c87f7",
    fontWeight: "700",
    fontSize: 11,
  },
  promoteButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(60, 135, 247, 0.15)",
  },
  promoteText: {
    color: "#3c87f7",
    fontWeight: "600",
  },
  logoutButton: {
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(128, 128, 128, 0.3)",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "500",
  },
  deleteButton: {
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "500",
  },
});
