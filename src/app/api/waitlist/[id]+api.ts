import { publishEvent } from "@/lib/ably";
import { requireAdmin } from "@/lib/auth";
import { posthogServer } from "@/lib/posthog-server";
import { getStreak } from "@/lib/services/streak";
import { supabase } from "@/lib/supabase";
import { getWaitingQueue } from "@/lib/waitlist";

export async function GET(request: Request, { id }: { id: string }) {
  const { data: waitlist, error: waitlistError } = await supabase
    .from("waitlists")
    .select("id, created_at, max_wins, game_duration_minutes")
    .eq("id", id)
    .single();

  if (waitlistError || !waitlist) {
    return Response.json({ error: "Waitlist not found" }, { status: 404 });
  }

  const queue = await getWaitingQueue(id);

  // Count playing from teams with status 'staged' or 'playing' (not from waitlist_players
  // which can accumulate stale "playing" rows)
  const { data: activeTeams } = await supabase
    .from("teams")
    .select("id, team_players(user_id, users(id, first_name, last_name))")
    .eq("waitlist_id", id)
    .in("status", ["staged", "playing"]);

  const playing = (activeTeams ?? []).flatMap((t) =>
    (t.team_players ?? []).map((tp: any) => ({
      user_id: tp.user_id,
      users: tp.users,
    })),
  );

  // Active game with teams
  const { data: activeGame } = await supabase
    .from("games")
    .select(
      `*,
      team1:teams!games_team1_id_fkey(id, color, team_players(user_id, users(id, first_name, last_name))),
      team2:teams!games_team2_id_fkey(id, color, team_players(user_id, users(id, first_name, last_name)))`,
    )
    .eq("waitlist_id", id)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1);

  const currentGame = activeGame?.[0] ?? null;

  // Staged teams — direct query on teams.status
  const { data: stagedTeamsRaw } = await supabase
    .from("teams")
    .select(
      "id, color, team_players(user_id, users(id, first_name, last_name))",
    )
    .eq("waitlist_id", id)
    .eq("status", "staged")
    .order("created_at", { ascending: true });

  const stagedTeams = (stagedTeamsRaw ?? []).map((t) => ({
    id: t.id,
    color: t.color,
    players: (t.team_players ?? []).map((tp: any) => ({
      user_id: tp.user_id,
      users: tp.users,
    })),
  }));

  // Compute streak from game history
  const { streak: rawStreak, teamId: rawStreakTeamId } = await getStreak(id);

  // If the streak team is no longer staged or playing, the streak has reset
  const streakTeamStillActive =
    rawStreakTeamId &&
    (stagedTeams.some((t) => t.id === rawStreakTeamId) ||
      (currentGame &&
        (currentGame.team1.id === rawStreakTeamId ||
          currentGame.team2.id === rawStreakTeamId)));

  const streak = streakTeamStillActive ? rawStreak : 0;
  const streakTeamId = streakTeamStillActive ? rawStreakTeamId : null;
  const streakMaxed = streak >= (waitlist as any).max_wins;
  const upNextCount = streakMaxed ? 10 : 5;

  return Response.json({
    waitlist: { ...waitlist, current_streak: streak },
    queue,
    playing: playing ?? [],
    activeGame: currentGame,
    stagedTeams,
    streakTeamId,
    upNext: queue.slice(0, upNextCount),
    upNextCount,
  });
}

// PATCH /api/waitlist/:id — update waitlist settings (admin only)
export async function PATCH(request: Request, { id }: { id: string }) {
  const admin = await requireAdmin(request);

  const body = await request.json();
  const updates: Record<string, number> = {};

  if (body.max_wins !== undefined) {
    if (body.max_wins !== 2 && body.max_wins !== 3) {
      return Response.json(
        { error: "max_wins must be 2 or 3" },
        { status: 400 },
      );
    }
    updates.max_wins = body.max_wins;
  }

  if (body.game_duration_minutes !== undefined) {
    if (body.game_duration_minutes !== 5 && body.game_duration_minutes !== 6) {
      return Response.json(
        { error: "game_duration_minutes must be 5 or 6" },
        { status: 400 },
      );
    }
    updates.game_duration_minutes = body.game_duration_minutes;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json(
      { error: "No valid settings provided" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("waitlists")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await publishEvent(`waitlist:${id}`, "settings:updated", {
    max_wins: data.max_wins,
    game_duration_minutes: data.game_duration_minutes,
  });

  posthogServer?.capture({
    distinctId: admin.id,
    event: "waitlist_settings_updated",
    properties: { waitlist_id: id, ...updates },
  });

  return Response.json(data);
}
