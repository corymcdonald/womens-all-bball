// ─── Shared types used across client, server, and components ───

export type User = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  clerk_id: string | null;
  role: "player" | "admin";
};

export type UserSummary = {
  id: string;
  first_name: string;
  last_name: string;
};

export type TeamPlayer = {
  user_id: string;
  users: UserSummary;
};

export type Team = {
  id: string;
  color: string;
  team_players: TeamPlayer[];
};

export type StagedTeam = {
  id: string;
  color: string;
  players: TeamPlayer[];
};

export type ActiveGame = {
  id: string;
  team1: Team;
  team2: Team;
  game_duration_minutes: number;
  max_wins: number;
};

export type WaitlistPlayer = {
  id: string;
  user_id: string;
  priority: number | null;
  status: string;
  created_at: string;
  users: UserSummary;
};

export type WaitlistDetail = {
  waitlist: {
    id: string;
    created_at: string;
    max_wins: number;
    game_duration_minutes: number;
    current_streak: number;
  };
  queue: WaitlistPlayer[];
  playing: Array<{ id: string; user_id: string; users: UserSummary }>;
  activeGame: ActiveGame | null;
  upNext: Array<{ id: string; user_id: string; users: UserSummary }>;
  streakTeamId: string | null;
  upNextCount: number;
  stagedTeams: StagedTeam[];
};

export type GameResult = {
  id: string;
  waitlist_id: string;
  winner_id: string | null;
  status: string;
  created_at: string;
  waitlist: { id: string; created_at: string };
  team1: Team;
  team2: Team;
  winner: { id: string; color: string } | null;
};

export type GamesResponse = {
  data: GameResult[];
  cursor: string | null;
};

export type CompleteGameResult = {
  game_id: string;
  winner_id: string;
  losing_team_id: string;
  streak: number;
  streak_maxed: boolean;
  players_needed: number;
};

export type Waitlist = {
  id: string;
  passcode?: string;
  created_at: string;
};

export type JoinToken = {
  token: string;
  expires_at: string;
  ttl_seconds: number;
};
