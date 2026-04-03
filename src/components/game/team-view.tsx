import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ColorPicker } from "@/components/game/color-picker";
import { Skeleton } from "@/components/skeleton";
import { ThemedText } from "@/components/themed-text";
import { COLOR_VALUES } from "@/constants/team-colors";
import { SemanticColors, Spacing } from "@/constants/theme";
import type { TeamPlayer } from "@/lib/types";

export type { TeamPlayer } from "@/lib/types";

const SKELETON_WIDTHS = [90, 70, 80, 85, 75];

type Props = {
  color: string;
  players: TeamPlayer[];
  record?: string;
  align?: "left" | "right";
  highlightUserId?: string;
  /** Show admin controls (edit button, winner button) */
  isAdmin?: boolean;
  /** Show the "X Wins" button (live game) */
  showWinnerButton?: boolean;
  confirming?: boolean;
  /** Show skeleton player list (mutation in progress) */
  mutating?: boolean;
  onDeclareWinner?: () => void;
  onPlayerTap?: (userId: string, playerName: string) => void;
  onUpdateColor?: (color: string) => void;
};

export function TeamView({
  color,
  players,
  record,
  align = "left",
  highlightUserId,
  isAdmin,
  showWinnerButton,
  confirming,
  mutating,
  onDeclareWinner,
  onPlayerTap,
  onUpdateColor,
}: Props) {
  const [editing, setEditing] = useState(false);
  const isRight = align === "right";
  const teamColor = COLOR_VALUES[color.toLowerCase()] ?? color.toLowerCase();

  return (
    <View
      style={[
        styles.teamCard,
        isRight && styles.teamCardRight,
        isAdmin && styles.teamCardBordered,
      ]}
    >
      {/* Header: always left-to-right [color name ... Edit] */}
      <View style={styles.teamHeader}>
        <View
          style={[styles.colorLabel, isRight && styles.colorLabelRight]}
        >
          <View
            style={[
              styles.colorDot,
              {
                backgroundColor: teamColor,
                boxShadow:
                  color.toLowerCase() === "white"
                    ? "0px 0px 1px rgba(0,0,0,1)"
                    : "",
              },
            ]}
          />
          <ThemedText type="smallBold">
            {color}
            {record ? (
              <ThemedText type="small" themeColor="textSecondary">
                {" "}
                ({record})
              </ThemedText>
            ) : null}
          </ThemedText>
        </View>
        {isAdmin && (
          <TouchableOpacity onPress={() => setEditing(!editing)}>
            <ThemedText type="small" style={styles.editButton}>
              {editing ? "Done" : "Edit"}
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* Player list or skeleton */}
      {mutating ? (
        <>
          {players.map((tp, i) => (
            <Skeleton
              key={tp.user_id}
              width={`${SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]}%`}
              height={12}
              style={isRight ? { alignSelf: "flex-end" } : undefined}
            />
          ))}
        </>
      ) : (
        players.map((tp) => {
          const isMe = highlightUserId === tp.user_id;
          const name = `${tp.users.first_name} ${tp.users.last_name[0]}.`;
          const text = (
            <ThemedText
              type={isMe ? "smallBold" : "small"}
              themeColor={isMe ? "text" : "textSecondary"}
              style={[
                isRight && styles.textRight,
                editing && styles.editablePlayer,
              ]}
            >
              {editing ? `${name} ✕` : name}
            </ThemedText>
          );
          if (editing && onPlayerTap) {
            return (
              <TouchableOpacity
                key={tp.user_id}
                onPress={() => onPlayerTap(tp.user_id, name)}
                activeOpacity={0.5}
              >
                {text}
              </TouchableOpacity>
            );
          }
          return <View key={tp.user_id}>{text}</View>;
        })
      )}

      {/* Color picker (edit mode) */}
      {editing && onUpdateColor && (
        <ColorPicker
          currentColor={color}
          align={align}
          onSelect={(c) => {
            onUpdateColor(c);
            setEditing(false);
          }}
        />
      )}

      {/* Winner button (admin, live, not editing) — full width */}
      {showWinnerButton && !editing && onDeclareWinner && (
        <TouchableOpacity
          style={[styles.winnerButton, confirming && styles.buttonDisabled]}
          onPress={onDeclareWinner}
          disabled={confirming}
        >
          <ThemedText style={styles.winnerButtonText}>
            {color} Wins
          </ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
}

export const styles = StyleSheet.create({
  teamCard: {
    flex: 1,
    gap: 4,
    padding: Spacing.two,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  teamCardRight: {
    alignItems: "flex-end",
  },
  teamCardBordered: {
    borderColor: "rgba(128, 128, 128, 0.2)",
  },
  teamHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  colorLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  colorLabelRight: {
    flexDirection: "row-reverse",
  },
  textRight: {
    textAlign: "right",
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  editButton: {
    color: SemanticColors.primary,
    fontWeight: "600",
  },
  editablePlayer: {
    color: SemanticColors.primary,
  },
  winnerButton: {
    marginTop: Spacing.one,
    alignSelf: "stretch",
    height: 36,
    borderRadius: 10,
    backgroundColor: SemanticColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  winnerButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
