import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { COLOR_VALUES, TEAM_COLORS } from "@/constants/team-colors";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type StagedTeam = {
  id: string;
  color: string;
  players: {
    user_id: string;
    users: { id: string; first_name: string; last_name: string };
  }[];
};

type Props = {
  teams: StagedTeam[];
  isAdmin: boolean;
  onUpdateColor: (teamId: string, color: string) => void;
};

function TeamCard({
  team,
  isAdmin,
  editingTeamId,
  setEditingTeamId,
  onUpdateColor,
  align = "left",
}: {
  team: StagedTeam;
  isAdmin: boolean;
  editingTeamId: string | null;
  setEditingTeamId: (id: string | null) => void;
  onUpdateColor?: (teamId: string, color: string) => void;
  align?: "left" | "right";
}) {
  const isRight = align === "right";
  return (
    <View style={[styles.teamCard, isRight && styles.teamCardRight]}>
      <View style={[styles.teamHeader, isRight && styles.teamHeaderRight]}>
        <View
          style={[
            styles.colorDot,
            {
              boxShadow:
                team.color.toLowerCase() === "white"
                  ? "0px 0px 1px rgba(0,0,0,1)"
                  : "",
              backgroundColor:
                COLOR_VALUES[team.color.toLowerCase()] ??
                team.color.toLowerCase(),
            },
          ]}
        />
        <ThemedText type="smallBold">{team.color}</ThemedText>
        {isAdmin && (
          <TouchableOpacity
            onPress={() =>
              setEditingTeamId(editingTeamId === team.id ? null : team.id)
            }
          >
            <ThemedText type="small" style={styles.changeColorText}>
              {editingTeamId === team.id ? "Done" : "Edit"}
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {editingTeamId === team.id && (
        <View style={[styles.colorPicker, isRight && styles.colorPickerRight]}>
          {TEAM_COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              onPress={() => {
                onUpdateColor?.(team.id, color);
                setEditingTeamId(null);
              }}
              style={[
                styles.colorOption,
                {
                  backgroundColor:
                    COLOR_VALUES[color.toLowerCase()] ?? color.toLowerCase(),
                },
                team.color === color && styles.colorOptionSelected,
              ]}
            />
          ))}
        </View>
      )}

      {team.players.map((tp) => (
        <ThemedText
          key={tp.user_id}
          type="small"
          themeColor="textSecondary"
          style={isRight && styles.textRight}
        >
          {tp.users.first_name} {tp.users.last_name[0]}.
        </ThemedText>
      ))}
    </View>
  );
}

export function StagedTeams({ teams, isAdmin, onUpdateColor }: Props) {
  const theme = useTheme();
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  if (teams.length === 0) return null;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundElement }]}
    >
      <ThemedText type="smallBold" style={styles.label}>
        Ready to Play
      </ThemedText>

      <View style={styles.teamsRow}>
        <TeamCard
          team={teams[0]}
          isAdmin={isAdmin}
          editingTeamId={editingTeamId}
          setEditingTeamId={setEditingTeamId}
          onUpdateColor={onUpdateColor}
        />

        {teams.length > 1 && (
          <>
            <ThemedText style={styles.vs}>vs</ThemedText>
            <TeamCard
              team={teams[1]}
              isAdmin={isAdmin}
              editingTeamId={editingTeamId}
              setEditingTeamId={setEditingTeamId}
              onUpdateColor={onUpdateColor}
              align="right"
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.two,
  },
  label: {
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  teamsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  teamCard: {
    flex: 1,
    gap: 4,
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
  changeColorText: {
    color: "#3c87f7",
    fontWeight: "600",
    marginLeft: "auto",
  },
  vs: {
    fontWeight: "700",
    fontSize: 12,
    color: "#888",
    paddingHorizontal: Spacing.two,
    alignSelf: "center",
  },
  colorPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  colorPickerRight: {
    justifyContent: "flex-end",
  },
  colorOption: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorOptionSelected: {
    borderColor: "#3c87f7",
    borderWidth: 3,
  },
});
