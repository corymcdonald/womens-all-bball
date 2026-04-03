import {
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { BorderRadius, SemanticColors, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type QueuePlayer = {
  id: string;
  user_id: string;
  status: string;
  users: { id: string; first_name: string; last_name: string };
};

type Props = {
  visible: boolean;
  playerName: string;
  teamId: string;
  userId: string;
  queue: QueuePlayer[];
  onSwap: (teamId: string, userId: string, replacementUserId?: string) => void;
  onClose: () => void;
};

export function SwapSheet({
  visible,
  playerName,
  teamId,
  userId,
  queue,
  onSwap,
  onClose,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const waitingPlayers = queue.filter((p) => p.status === "waiting");

  function handleRemove() {
    onSwap(teamId, userId);
    onClose();
  }

  function handleReplace(replacementUserId: string) {
    onSwap(teamId, userId, replacementUserId);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.background,
              paddingBottom: insets.bottom + Spacing.three,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="subtitle">Swap {playerName}</ThemedText>
            <TouchableOpacity onPress={onClose}>
              <ThemedText style={styles.closeText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Remove without replacement */}
          <Button
            label="Remove from team (back to queue)"
            variant="danger"
            onPress={handleRemove}
          />

          {/* Replacement list */}
          {waitingPlayers.length > 0 && (
            <>
              <View style={styles.divider}>
                <View
                  style={[
                    styles.dividerLine,
                    { backgroundColor: theme.textSecondary, opacity: 0.3 },
                  ]}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  Replace with
                </ThemedText>
                <View
                  style={[
                    styles.dividerLine,
                    { backgroundColor: theme.textSecondary, opacity: 0.3 },
                  ]}
                />
              </View>

              <FlatList
                data={waitingPlayers}
                keyExtractor={(item) => item.id}
                style={styles.list}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.playerRow,
                      { borderBottomColor: `${theme.textSecondary}40` },
                    ]}
                    onPress={() => handleReplace(item.user_id)}
                    activeOpacity={0.6}
                  >
                    <ThemedText>
                      {item.users.first_name} {item.users.last_name[0]}.
                    </ThemedText>
                    <ThemedText type="small" style={styles.swapAction}>
                      Swap in
                    </ThemedText>
                  </TouchableOpacity>
                )}
              />
            </>
          )}

          {waitingPlayers.length === 0 && (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.emptyText}
            >
              No players in queue to swap in
            </ThemedText>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.large,
    borderTopRightRadius: BorderRadius.large,
    padding: Spacing.three,
    gap: Spacing.three,
    maxHeight: "70%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  closeText: {
    color: SemanticColors.primary,
    fontWeight: "600",
    fontSize: 16,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  list: {
    flexGrow: 0,
  },
  playerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  swapAction: {
    color: SemanticColors.primary,
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: Spacing.two,
  },
});
