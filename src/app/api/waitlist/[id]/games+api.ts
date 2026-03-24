import { supabase } from "@/lib/supabase";

export async function GET(request: Request, { id }: { id: string }) {
  const { data, error } = await supabase
    .from("games")
    .select(
      `*,
      team1:teams!games_team1_id_fkey(id, color, team_players(user_id, users(id, first_name, last_name))),
      team2:teams!games_team2_id_fkey(id, color, team_players(user_id, users(id, first_name, last_name))),
      winner:teams!games_winner_id_fkey(id, color)`,
    )
    .eq("waitlist_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
