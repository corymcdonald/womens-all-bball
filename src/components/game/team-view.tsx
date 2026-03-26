import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { COLOR_VALUES } from "@/constants/team-colors";
import { SemanticColors, Spacing } from "@/constants/theme";
import type { TeamPlayer } from "@/lib/types";

export type { TeamPlayer } from "@/lib/types";

type Props = {
  color: string;
  players: TeamPlayer[];
  record?: string;
  align?: "left" | "right";
  isSelected?: boolean;
  isTappable?: boolean;
  onTap?: () => void;
  highlightUserId?: string;
};

export function TeamView({
  color,
  players,
  record,
  align = "left",
  isSelected,
  isTappable,
  onTap,
  highlightUserId,
}: Props) {
  const isRight = align === "right";
  const teamColor = COLOR_VALUES[color.toLowerCase()] ?? color.toLowerCase();

  const content = (
    <View
      style={[
        styles.teamCard,
        isTappable && !isSelected && styles.teamCardTappable,
        isSelected && styles.teamCardSelected,
        isRight && styles.teamCardRight,
      ]}
    >
      <View style={[styles.teamHeader, isRight && styles.teamHeaderRight]}>
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
      {players.map((tp) => {
        const isMe = highlightUserId === tp.user_id;
        return (
          <ThemedText
            key={tp.user_id}
            type={isMe ? "smallBold" : "small"}
            themeColor={isMe ? "text" : "textSecondary"}
            style={isRight && styles.textRight}
          >
            {tp.users.first_name} {tp.users.last_name[0]}.
          </ThemedText>
        );
      })}
      {isTappable && (
        <View
          style={[
            styles.selectIndicator,
            isSelected && styles.selectIndicatorSelected,
            isRight && styles.selectIndicatorRight,
          ]}
        >
          <ThemedText
            type="small"
            style={[
              styles.selectIndicatorText,
              isSelected && styles.selectIndicatorTextSelected,
            ]}
          >
            {isSelected ? "Winner" : "Tap to select"}
          </ThemedText>
        </View>
      )}
    </View>
  );

  if (isTappable && onTap) {
    return (
      <TouchableOpacity
        onPress={onTap}
        activeOpacity={0.7}
        style={styles.teamTouchable}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

export const styles = StyleSheet.create({
  teamTouchable: {
    flex: 1,
  },
  teamCard: {
    flex: 1,
    gap: 4,
    padding: Spacing.two,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  teamCardTappable: {
    borderColor: "rgba(128, 128, 128, 0.2)",
  },
  teamCardSelected: {
    borderColor: SemanticColors.primary,
  },
  teamCardRight: {
    alignItems: "flex-end",
  },
  teamHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    marginBottom: 4,
  },
  teamHeaderRight: {
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
  selectIndicator: {
    marginTop: Spacing.one,
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
    borderRadius: 8,
    backgroundColor: "rgba(128, 128, 128, 0.1)",
    alignSelf: "flex-start",
  },
  selectIndicatorSelected: {
    backgroundColor: SemanticColors.primary,
  },
  selectIndicatorRight: {
    alignSelf: "flex-end",
  },
  selectIndicatorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
  },
  selectIndicatorTextSelected: {
    color: "#fff",
  },
});
