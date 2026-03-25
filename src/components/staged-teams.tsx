import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { COLOR_VALUES, TEAM_COLORS } from "@/constants/team-colors";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type StagedTeam = {
  id: string;
  color: string;
  players: Array<{
    user_id: string;
    users: { id: string; first_name: string; last_name: string };
  }>;
};

type Props = {
  teams: StagedTeam[];
  isAdmin: boolean;
  onUpdateColor: (teamId: string, color: string) => void;
  onStartGame?: (team1Id: string, team2Id: string) => void;
};

function TeamCard({
  team,
  isAdmin,
  editingTeamId,
  setEditingTeamId,
  onUpdateColor,
}: {
  team: StagedTeam;
  isAdmin: boolean;
  editingTeamId: string | null;
  setEditingTeamId: (id: string | null) => void;
  onUpdateColor: (teamId: string, color: string) => void;
}) {
  return (
    <View style={styles.teamCard}>
      <View style={styles.teamHeader}>
        <View
          style={[
            styles.colorDot,
            {
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
        <View style={styles.colorPicker}>
          {TEAM_COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              onPress={() => {
                onUpdateColor(team.id, color);
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
        >
          {tp.users.first_name} {tp.users.last_name[0]}.
        </ThemedText>
      ))}
    </View>
  );
}

export function StagedTeams({
  teams,
  isAdmin,
  onUpdateColor,
  onStartGame,
}: Props) {
  const theme = useTheme();
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  if (teams.length === 0) return null;

  const canStartGame = isAdmin && teams.length >= 2 && onStartGame;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundElement },
      ]}
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
            />
          </>
        )}
      </View>

      {canStartGame && (
        <TouchableOpacity
          style={styles.startGameButton}
          onPress={() => onStartGame(teams[0].id, teams[1].id)}
        >
          <ThemedText style={styles.startGameText} themeColor="background">
            Start Game
          </ThemedText>
        </TouchableOpacity>
      )}
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
  },
  teamCard: {
    flex: 1,
    gap: 4,
  },
  teamHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    marginBottom: 4,
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
    paddingTop: Spacing.four,
  },
  colorPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
    paddingVertical: Spacing.one,
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
  startGameButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  startGameText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
