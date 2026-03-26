import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth, useUser as useClerkUser } from "@clerk/expo";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorText } from "@/components/ui/error-text";
import { StyledTextInput } from "@/components/ui/text-input";
import { JoinQRCode } from "@/components/join/join-qr-code";
import AuthScreen from "@/components/screens/auth";
import { SemanticColors, Spacing, WebNavHeight } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useUser } from "@/lib/user-context";
import { formatWaitlistDate } from "@/lib/format-date";
import * as api from "@/lib/api";
import { posthog } from "@/lib/posthog";
import type { Waitlist } from "@/lib/types";

export default function SettingsScreen() {
  const theme = useTheme();
  const { user, login, logout } = useUser();
  const { signOut: clerkSignOut } = useAuth();
  const { user: clerkUser } = useClerkUser();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const isAdmin = user?.role === "admin";

  // Profile
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [profileSaved, setProfileSaved] = useState(false);
  const [error, setError] = useState("");

  // Admin: waitlists
  const [waitlists, setWaitlists] = useState<Waitlist[]>([]);

  // Admin: current admins list
  const [admins, setAdmins] = useState<
    { id: string; first_name: string; last_name: string }[]
  >([]);

  // Admin: user search
  const [adminSearch, setAdminSearch] = useState("");
  const [searchResults, setSearchResults] = useState<
    {
      id: string;
      first_name: string;
      last_name: string;
      role: string;
    }[]
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

  // When Clerk auth completes in the link modal, link the clerk_id to the Supabase user
  useEffect(() => {
    if (!showLinkModal || !clerkUser?.id || !user || user.clerk_id) return;

    async function linkAccount() {
      try {
        const updated = await api.linkClerkId(user!.id, clerkUser!.id);
        await login(updated);
        posthog.capture("account_linked");
        setShowLinkModal(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to link account");
        setShowLinkModal(false);
      }
    }

    linkAccount();
  }, [showLinkModal, clerkUser?.id, user?.id, user?.clerk_id]);

  async function handleLogout() {
    posthog.capture("user_logged_out");
    if (user?.clerk_id) {
      try {
        await clerkSignOut();
      } catch {
        // Clerk session may not exist — continue with local logout
      }
    }
    await logout();
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
      const wl = await api.createWaitlist();
      posthog.capture("waitlist_created", { waitlist_id: wl.id });
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
              style={profileSaved ? { backgroundColor: SemanticColors.success } : undefined}
            />
          </Card>

          {/* Admin: QR Code */}
          {isAdmin && latestWaitlist && (
            <Card>
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
            </Card>
          )}

          {/* Admin: Waitlists */}
          {isAdmin && (
            <Card>
              <ThemedText type="smallBold" style={styles.sectionLabel}>
                Waitlists
              </ThemedText>
              <Button
                label="Create New Waitlist"
                onPress={handleCreateWaitlist}
              />

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
            </Card>
          )}

          {/* Admin: Manage Admins */}
          {isAdmin && (
            <Card>
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
              <StyledTextInput
                style={{ backgroundColor: theme.background }}
                placeholder="Search by name..."
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
            </Card>
          )}

          {/* Account */}
          <Card>
            <ThemedText type="smallBold" style={styles.sectionLabel}>
              Account
            </ThemedText>
            {!user.clerk_id && (
              <Button
                label="Link Full Account"
                onPress={() => setShowLinkModal(true)}
              />
            )}
            {user.clerk_id && (
              <View style={styles.linkedBadge}>
                <ThemedText type="small" themeColor="textSecondary">
                  Full account linked
                </ThemedText>
              </View>
            )}
            <Button
              label="Log Out"
              variant="outline"
              onPress={handleLogout}
            />
            <Button
              label="Delete Account"
              variant="danger"
              onPress={handleDeleteAccount}
            />
          </Card>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showLinkModal}
        animationType="slide"
        onRequestClose={() => setShowLinkModal(false)}
      >
        <AuthScreen onDismiss={() => setShowLinkModal(false)} linkOnly />
      </Modal>
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
    color: SemanticColors.primary,
    fontWeight: "700",
    fontSize: 11,
  },
  promoteButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: `${SemanticColors.primary}26`,
  },
  promoteText: {
    color: SemanticColors.primary,
    fontWeight: "600",
  },
  linkedBadge: {
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: SemanticColors.success,
  },
});
