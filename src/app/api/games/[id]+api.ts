import { supabase } from "@/lib/supabase";

export async function GET(request: Request, { id }: { id: string }) {
  const { data: game, error } = await supabase
    .from("games")
    .select(
      `*,
      team1:teams!games_team1_id_fkey(id, color, team_players(user_id, users(id, first_name, last_name))),
      team2:teams!games_team2_id_fkey(id, color, team_players(user_id, users(id, first_name, last_name))),
      winner:teams!games_winner_id_fkey(id, color)`,
    )
    .eq("id", id)
    .single();

  if (error || !game) {
    return Response.json({ error: "Game not found" }, { status: 404 });
  }

  return Response.json(game);
}
