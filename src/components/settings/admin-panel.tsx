import { useCallback, useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { JoinQRCode } from "@/components/join/join-qr-code";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StyledTextInput } from "@/components/ui/text-input";
import { SemanticColors, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import * as api from "@/lib/api";
import { formatWaitlistDate } from "@/lib/format-date";
import { posthog } from "@/lib/posthog";
import type { Waitlist } from "@/lib/types";

type Props = {
  userId: string;
  onError: (msg: string) => void;
};

export function AdminPanel({ userId, onError }: Props) {
  const theme = useTheme();
  const [waitlists, setWaitlists] = useState<Waitlist[]>([]);
  const [admins, setAdmins] = useState<
    { id: string; first_name: string; last_name: string }[]
  >([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: string; first_name: string; last_name: string; role: string }[]
  >([]);

  const fetchAdminData = useCallback(async () => {
    try {
      const [waitlistData, adminData] = await Promise.all([
        api.listWaitlists(),
        api.listAdmins(),
      ]);
      setWaitlists(waitlistData);
      setAdmins(adminData);
    } catch {}
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  async function handleCreateWaitlist() {
    try {
      const wl = await api.createWaitlist();
      posthog.capture("waitlist_created", { waitlist_id: wl.id });
      await fetchAdminData();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to create waitlist");
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

  async function handlePromote(targetUserId: string) {
    try {
      await api.promoteUser(targetUserId);
      setSearchResults((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, role: "admin" } : u)),
      );
      const adminData = await api.listAdmins();
      setAdmins(adminData);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to promote");
    }
  }

  const latestWaitlist = waitlists[0];

  return (
    <>
      {/* QR Code */}
      {latestWaitlist && (
        <Card>
          <ThemedText type="smallBold" style={styles.sectionLabel}>
            Current Session — {formatWaitlistDate(latestWaitlist.created_at)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Passcode: {latestWaitlist.passcode}
          </ThemedText>
          <JoinQRCode waitlistId={latestWaitlist.id} scheme="womensallbball" />
        </Card>
      )}

      {/* Waitlists */}
      <Card>
        <ThemedText type="smallBold" style={styles.sectionLabel}>
          Waitlists
        </ThemedText>
        <Button label="Create New Waitlist" onPress={handleCreateWaitlist} />
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

      {/* Manage Admins */}
      <Card>
        <ThemedText type="smallBold" style={styles.sectionLabel}>
          Admins
        </ThemedText>
        {admins.map((a) => (
          <View key={a.id} style={styles.listRow}>
            <ThemedText type="small">
              {a.first_name} {a.last_name}
            </ThemedText>
            {a.id === userId && (
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
    </>
  );
}

const styles = StyleSheet.create({
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
});
