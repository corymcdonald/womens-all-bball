import { useEffect, useState } from "react";
import { Alert, Modal, Platform, StyleSheet, View } from "react-native";
import { useAuth, useUser as useClerkUser } from "@clerk/expo";

import AuthScreen from "@/components/screens/auth";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SemanticColors } from "@/constants/theme";
import * as api from "@/lib/api";
import { posthog } from "@/lib/posthog";
import { useUser } from "@/lib/user-context";

type Props = {
  onError: (msg: string) => void;
};

export function AccountSection({ onError }: Props) {
  const { user, login, logout } = useUser();
  const { signOut: clerkSignOut } = useAuth();
  const { user: clerkUser } = useClerkUser();
  const [showLinkModal, setShowLinkModal] = useState(false);

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
        onError(e instanceof Error ? e.message : "Failed to link account");
        setShowLinkModal(false);
      }
    }

    linkAccount();
  }, [showLinkModal, clerkUser?.id, user?.id, user?.clerk_id, login, onError]);

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
        onError(e instanceof Error ? e.message : "Failed to delete account");
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

  if (!user) return null;

  return (
    <>
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
        <Button label="Log Out" variant="outline" onPress={handleLogout} />
        <Button
          label="Delete Account"
          variant="danger"
          onPress={handleDeleteAccount}
        />
      </Card>

      <Modal
        visible={showLinkModal}
        animationType="slide"
        onRequestClose={() => setShowLinkModal(false)}
      >
        <AuthScreen onDismiss={() => setShowLinkModal(false)} linkOnly />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    textTransform: "uppercase",
    letterSpacing: 1,
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
