import { publishEvent } from "@/lib/ably";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getWaitingQueue } from "@/lib/waitlist";

export async function GET(request: Request, { id }: { id: string }) {
  const { data: waitlist, error: waitlistError } = await supabase
    .from("waitlists")
    .select("id, created_at, max_wins, game_duration_minutes, current_streak")
    .eq("id", id)
    .single();

  if (waitlistError || !waitlist) {
    return Response.json({ error: "Waitlist not found" }, { status: 404 });
  }

  const queue = await getWaitingQueue(id);

  const { data: playing } = await supabase
    .from("waitlist_players")
    .select("*, users(id, first_name, last_name)")
    .eq("waitlist_id", id)
    .eq("status", "playing");

  // Get active game with teams
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

  // Find "staged" teams: teams with playing players that aren't part of an active game.
  // These are teams formed via form-team but not yet in a game.
  const activeTeamIds = new Set<string>();
  if (currentGame) {
    activeTeamIds.add(currentGame.team1_id);
    activeTeamIds.add(currentGame.team2_id);
  }

  // Get all teams that have players currently in "playing" status for this waitlist
  const playingUserIds = (playing ?? []).map((p: any) => p.user_id);
  let stagedTeams: any[] = [];

  if (playingUserIds.length > 0) {
    const { data: teamPlayers } = await supabase
      .from("team_players")
      .select("team_id, user_id, teams(id, color), users(id, first_name, last_name)")
      .in("user_id", playingUserIds);

    // Group by team, exclude teams in active game
    const teamMap = new Map<string, { id: string; color: string; players: any[] }>();
    for (const tp of teamPlayers ?? []) {
      const teamId = tp.team_id;
      if (activeTeamIds.has(teamId)) continue;

      if (!teamMap.has(teamId)) {
        teamMap.set(teamId, {
          id: teamId,
          color: (tp.teams as any)?.color ?? "Unknown",
          players: [],
        });
      }
      teamMap.get(teamId)!.players.push({
        user_id: tp.user_id,
        users: tp.users,
      });
    }

    // Only include teams with 5 players (fully formed)
    stagedTeams = Array.from(teamMap.values()).filter(
      (t) => t.players.length === 5,
    );
  }

  const streakMaxed =
    (waitlist as any).current_streak >= (waitlist as any).max_wins;
  const upNextCount = streakMaxed ? 10 : 5;

  return Response.json({
    waitlist,
    queue,
    playing: playing ?? [],
    activeGame: currentGame,
    stagedTeams,
    upNext: queue.slice(0, upNextCount),
    upNextCount,
  });
}

// PATCH /api/waitlist/:id — update waitlist settings (admin only)
export async function PATCH(request: Request, { id }: { id: string }) {
  await requireAdmin(request);

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

  return Response.json(data);
}
