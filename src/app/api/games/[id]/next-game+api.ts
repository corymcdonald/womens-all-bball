import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { getWaitingQueue, transitionStatus } from "@/lib/waitlist";
import { publishEvent } from "@/lib/ably";

const TEAM_COLORS = [
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Purple",
  "Orange",
  "Pink",
  "White",
  "Black",
  "Gray",
];

async function formTeamFromQueue(
  waitlistId: string,
  queue: any[],
  excludeColors: string[],
) {
  const color =
    TEAM_COLORS.find((c) => !excludeColors.includes(c)) ?? TEAM_COLORS[0];

  const { data: team } = await supabase
    .from("teams")
    .insert({ color })
    .select()
    .single();

  if (!team) throw new Error("Failed to create team");

  const players = queue.slice(0, 5);

  await supabase
    .from("team_players")
    .insert(players.map((wp) => ({ team_id: team.id, user_id: wp.user_id })));

  for (const wp of players) {
    await transitionStatus(wp.id, "waiting", "playing");
  }

  return { team, players };
}

export async function POST(request: Request, { id }: { id: string }) {
  await requireAdmin(request);

  const body = await request.json();

  // Get the previous game
  const { data: prevGame } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .eq("status", "completed")
    .single();

  if (!prevGame) {
    return Response.json(
      { error: "Completed game not found" },
      { status: 404 },
    );
  }

  // Get the waitlist for current settings
  const { data: waitlist } = await supabase
    .from("waitlists")
    .select("current_streak, max_wins, game_duration_minutes")
    .eq("id", prevGame.waitlist_id)
    .single();

  if (!waitlist) {
    return Response.json({ error: "Waitlist not found" }, { status: 404 });
  }

  const queue = await getWaitingQueue(prevGame.waitlist_id);
  const fullRotation = !body.staying_team_id;

  if (fullRotation) {
    // Both teams rotated off — need 10 players for 2 new teams
    if (queue.length < 10) {
      return Response.json(
        {
          error: `Not enough players for full rotation. Need 10, have ${queue.length}`,
        },
        { status: 400 },
      );
    }

    const team1Result = await formTeamFromQueue(
      prevGame.waitlist_id,
      queue.slice(0, 5),
      [],
    );
    const team2Result = await formTeamFromQueue(
      prevGame.waitlist_id,
      queue.slice(5, 10),
      [team1Result.team.color],
    );

    const { data: newGame, error } = await supabase
      .from("games")
      .insert({
        waitlist_id: prevGame.waitlist_id,
        team1_id: team1Result.team.id,
        team2_id: team2Result.team.id,
        status: "in_progress",
        max_wins: waitlist.max_wins,
        game_duration_minutes: waitlist.game_duration_minutes,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    await publishEvent(`waitlist:${prevGame.waitlist_id}`, "game:started", {
      game_id: newGame.id,
    });

    return Response.json({
      game: newGame,
      full_rotation: true,
      team1: {
        ...team1Result.team,
        players: team1Result.players.map((wp) => ({
          waitlist_player_id: wp.id,
          user_id: wp.user_id,
          user: wp.users,
        })),
      },
      team2: {
        ...team2Result.team,
        players: team2Result.players.map((wp) => ({
          waitlist_player_id: wp.id,
          user_id: wp.user_id,
          user: wp.users,
        })),
      },
    });
  } else {
    // Winning team stays — need 5 players for 1 challenger team
    if (queue.length < 5) {
      return Response.json(
        {
          error: `Not enough players for challenger team. Need 5, have ${queue.length}`,
        },
        { status: 400 },
      );
    }

    const { data: stayingTeam } = await supabase
      .from("teams")
      .select("color")
      .eq("id", body.staying_team_id)
      .single();

    const challengerResult = await formTeamFromQueue(
      prevGame.waitlist_id,
      queue.slice(0, 5),
      [stayingTeam?.color ?? ""],
    );

    const { data: newGame, error } = await supabase
      .from("games")
      .insert({
        waitlist_id: prevGame.waitlist_id,
        team1_id: body.staying_team_id,
        team2_id: challengerResult.team.id,
        status: "in_progress",
        max_wins: waitlist.max_wins,
        game_duration_minutes: waitlist.game_duration_minutes,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    await publishEvent(`waitlist:${prevGame.waitlist_id}`, "game:started", {
      game_id: newGame.id,
    });

    return Response.json({
      game: newGame,
      full_rotation: false,
      challenger_team: {
        ...challengerResult.team,
        players: challengerResult.players.map((wp) => ({
          waitlist_player_id: wp.id,
          user_id: wp.user_id,
          user: wp.users,
        })),
      },
    });
  }
}
