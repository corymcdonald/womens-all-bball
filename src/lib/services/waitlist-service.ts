import { supabase } from "@/lib/supabase";
import type { TeamPlayer, WaitlistDetail } from "@/lib/types";
import { getWaitingQueue } from "@/lib/waitlist";
import { getStreak } from "./streak";
import { TEAM_SIZE } from "./team-service";

function isStreakTeamActive(
  teamId: string | null,
  stagedTeams: { id: string }[],
  currentGame: { team1: { id: string }; team2: { id: string } } | null,
): boolean {
  if (!teamId) return false;
  if (stagedTeams.some((t) => t.id === teamId)) return true;
  if (currentGame) {
    return currentGame.team1.id === teamId || currentGame.team2.id === teamId;
  }
  return false;
}

function computeStreakState(
  rawStreak: number,
  rawTeamId: string | null,
  maxWins: number,
  stagedTeams: { id: string }[],
  currentGame: { team1: { id: string }; team2: { id: string } } | null,
): { streak: number; streakTeamId: string | null; upNextCount: number } {
  const active = isStreakTeamActive(rawTeamId, stagedTeams, currentGame);
  const streak = active ? rawStreak : 0;
  const streakTeamId = active ? rawTeamId : null;

  const upNextCount = streak >= maxWins ? TEAM_SIZE * 2 : TEAM_SIZE;

  return { streak, streakTeamId, upNextCount };
}

function mapTeamPlayers(
  raw:
    | {
        user_id: string;
        users: { id: string; first_name: string; last_name: string };
      }[]
    | null,
): TeamPlayer[] {
  return (raw ?? []).map((tp) => ({
    user_id: tp.user_id,
    users: tp.users,
  }));
}

export async function getWaitlistDetail(
  waitlistId: string,
): Promise<WaitlistDetail | null> {
  const { data: waitlist, error: waitlistError } = await supabase
    .from("waitlists")
    .select("id, created_at, max_wins, game_duration_minutes")
    .eq("id", waitlistId)
    .single();

  if (waitlistError || !waitlist) return null;

  const queue = await getWaitingQueue(waitlistId);

  // Playing players from active teams (not from waitlist_players which can have stale rows)
  const { data: activeTeams } = await supabase
    .from("teams")
    .select("id, team_players(user_id, users(id, first_name, last_name))")
    .eq("waitlist_id", waitlistId)
    .in("status", ["staged", "playing"]);

  const playing = (activeTeams ?? []).flatMap((t) =>
    mapTeamPlayers(t.team_players),
  );

  // Active game with teams
  const { data: activeGame } = await supabase
    .from("games")
    .select(
      `*,
      team1:teams!games_team1_id_fkey(id, color, team_players(user_id, users(id, first_name, last_name))),
      team2:teams!games_team2_id_fkey(id, color, team_players(user_id, users(id, first_name, last_name)))`,
    )
    .eq("waitlist_id", waitlistId)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1);

  const currentGame = activeGame?.[0] ?? null;

  // Staged teams
  const { data: stagedTeamsRaw } = await supabase
    .from("teams")
    .select(
      "id, color, team_players(user_id, users(id, first_name, last_name))",
    )
    .eq("waitlist_id", waitlistId)
    .eq("status", "staged")
    .order("created_at", { ascending: true });

  const stagedTeams = (stagedTeamsRaw ?? []).map((t) => ({
    id: t.id,
    color: t.color,
    players: mapTeamPlayers(t.team_players),
  }));

  const { streak: rawStreak, teamId: rawStreakTeamId } =
    await getStreak(waitlistId);

  const { streak, streakTeamId, upNextCount } = computeStreakState(
    rawStreak,
    rawStreakTeamId,
    waitlist.max_wins,
    stagedTeams,
    currentGame,
  );

  return {
    waitlist: { ...waitlist, current_streak: streak },
    queue,
    playing,
    activeGame: currentGame,
    upNext: queue.slice(0, upNextCount),
    upNextCount,
    stagedTeams,
    streakTeamId,
  };
}
