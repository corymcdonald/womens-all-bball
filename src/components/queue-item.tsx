import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type QueuePlayer = {
  id: string;
  user_id: string;
  status: string;
  users: { id: string; first_name: string; last_name: string };
};

type Props = {
  item: QueuePlayer;
  index: number;
  isMe: boolean;
  isUpNext: boolean;
  editMode: boolean;
  isAdmin: boolean;
  drag?: () => void;
  isActive?: boolean;
  onMarkAbsent: (id: string) => void;
  onMarkPresent: (id: string) => void;
  onMarkLeft: (id: string) => void;
};

export function QueueItem({
  item,
  index,
  isMe,
  isUpNext,
  editMode,
  isAdmin,
  drag,
  isActive,
  onMarkAbsent,
  onMarkPresent,
  onMarkLeft,
}: Props) {
  const theme = useTheme();
  const isAbsent = item.status === "absent";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundElement },
        isUpNext && !isAbsent && styles.upNext,
        isMe && styles.myRow,
        isAbsent && styles.absentRow,
        isActive && styles.activeRow,
      ]}
    >
      {/* Drag handle or position number */}
      {isAdmin && editMode && drag ? (
        <TouchableOpacity onPressIn={drag} style={styles.dragHandle}>
          <ThemedText type="small" themeColor="textSecondary">
            ≡
          </ThemedText>
        </TouchableOpacity>
      ) : (
        <View style={styles.positionBadge}>
          <ThemedText type="smallBold">{index + 1}</ThemedText>
        </View>
      )}

      <ThemedText style={[styles.name, isAbsent && styles.absentText]}>
        {item.users.first_name} {item.users.last_name[0]}.
        {isMe ? " (You)" : ""}
      </ThemedText>

      {/* Self-service: absent player can mark themselves present */}
      {isAbsent && isMe && (
        <TouchableOpacity
          onPress={() => onMarkPresent(item.id)}
          style={styles.imHereButton}
        >
          <ThemedText type="small" style={styles.imHereText}>
            I'm here!
          </ThemedText>
        </TouchableOpacity>
      )}

      {/* Badge for other absent players */}
      {isAbsent && !isMe && (
        <ThemedText type="small" style={styles.absentBadge}>
          ABSENT
        </ThemedText>
      )}

      {/* Up next badge */}
      {isUpNext && !isAbsent && !editMode && (
        <ThemedText type="small" style={styles.upNextBadge}>
          UP NEXT
        </ThemedText>
      )}

      {/* Admin edit controls */}
      {isAdmin && editMode && (
        <View style={styles.adminActions}>
          {!isAbsent ? (
            <TouchableOpacity
              onPress={() => onMarkAbsent(item.id)}
              style={styles.absentButton}
            >
              <ThemedText type="small" style={{ color: "#f59e0b" }}>
                Absent
              </ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => onMarkPresent(item.id)}
              style={styles.presentButton}
            >
              <ThemedText type="small" style={{ color: "#10b981" }}>
                Present
              </ThemedText>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => onMarkLeft(item.id)}
            style={styles.leftButton}
          >
            <ThemedText type="small" style={{ color: "#ef4444" }}>
              Left
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.two,
    borderRadius: 10,
    gap: Spacing.two,
  },
  upNext: {
    borderLeftWidth: 3,
    borderLeftColor: "#3c87f7",
  },
  myRow: {
    borderRightWidth: 3,
    borderRightColor: "#10b981",
  },
  absentRow: {
    opacity: 0.5,
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
  },
  activeRow: {
    opacity: 0.9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  positionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dragHandle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    flex: 1,
  },
  absentText: {
    textDecorationLine: "line-through",
  },
  upNextBadge: {
    color: "#3c87f7",
    fontWeight: "700",
    fontSize: 11,
  },
  absentBadge: {
    color: "#f59e0b",
    fontWeight: "700",
    fontSize: 11,
  },
  imHereButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  imHereText: {
    color: "#10b981",
    fontWeight: "700",
  },
  adminActions: {
    flexDirection: "row",
    gap: Spacing.one,
  },
  absentButton: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  presentButton: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  leftButton: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
});
