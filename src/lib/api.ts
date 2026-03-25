import { getStoredUser } from "./user-store";

const API_BASE = "/api";

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const stored = await getStoredUser();
  const userId = stored ? JSON.parse(stored).id : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(userId ? { "x-user-id": userId } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  return res.json();
}

// Users
export function getUser(id: string) {
  return request<{
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    role: "player" | "admin";
  }>(`/users/${id}`);
}

type UserResult = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: "player" | "admin";
};

export function updateUser(
  id: string,
  body: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    role?: string;
  },
) {
  return request<UserResult>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteUser(id: string) {
  return request(`/users/${id}`, { method: "DELETE" });
}

export function searchUsers(query: string) {
  return request<UserResult[]>(
    `/users?q=${encodeURIComponent(query)}`,
  );
}

export function listAdmins() {
  return request<UserResult[]>("/users?role=admin");
}

export function promoteUser(id: string) {
  return updateUser(id, { role: "admin" });
}

export function registerUser(body: {
  first_name: string;
  last_name: string;
  phone?: string;
}) {
  return request<{
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    role: "player" | "admin";
  }>("/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Waitlists
export function createWaitlist(passcode?: string) {
  return request<{ id: string; passcode: string; created_at: string }>(
    "/waitlist",
    {
      method: "POST",
      body: JSON.stringify(passcode ? { passcode } : {}),
    },
  );
}

export function listWaitlists() {
  return request<Array<{ id: string; passcode: string; created_at: string }>>(
    "/waitlist",
  );
}

export function getWaitlist(id: string) {
  return request<{
    waitlist: {
      id: string;
      created_at: string;
      max_wins: number;
      game_duration_minutes: number;
      current_streak: number;
    };
    queue: Array<{
      id: string;
      user_id: string;
      priority: number | null;
      status: string;
      created_at: string;
      users: { id: string; first_name: string; last_name: string };
    }>;
    playing: Array<{
      id: string;
      user_id: string;
      users: { id: string; first_name: string; last_name: string };
    }>;
    activeGame: {
      id: string;
      team1: {
        id: string;
        color: string;
        team_players: Array<{
          user_id: string;
          users: { id: string; first_name: string; last_name: string };
        }>;
      };
      team2: {
        id: string;
        color: string;
        team_players: Array<{
          user_id: string;
          users: { id: string; first_name: string; last_name: string };
        }>;
      };
      max_wins: number;
      game_duration_minutes: number;
    } | null;
    upNext: Array<{
      id: string;
      user_id: string;
      users: { id: string; first_name: string; last_name: string };
    }>;
    upNextCount: number;
    stagedTeams: Array<{
      id: string;
      color: string;
      players: Array<{
        user_id: string;
        users: { id: string; first_name: string; last_name: string };
      }>;
    }>;
  }>(`/waitlist/${id}`);
}

export function generateJoinToken(id: string) {
  return request<{ token: string; expires_at: string; ttl_seconds: number }>(
    `/waitlist/${id}/token`,
    { method: "POST" },
  );
}

export function joinWaitlistWithToken(id: string, token: string) {
  return request(`/waitlist/${id}/join-token`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function joinWaitlist(id: string, passcode: string) {
  return request(`/waitlist/${id}/join`, {
    method: "POST",
    body: JSON.stringify({ passcode }),
  });
}

export function leaveWaitlist(id: string) {
  return request(`/waitlist/${id}/leave`, { method: "POST" });
}

export function rejoinWaitlist(id: string) {
  return request(`/waitlist/${id}/rejoin`, { method: "POST" });
}

// Staff - Waitlist
export function updateWaitlistSettings(
  id: string,
  settings: { max_wins?: number; game_duration_minutes?: number },
) {
  return request(`/waitlist/${id}`, {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}

export function reorderQueue(id: string, playerIds: string[]) {
  return request(`/waitlist/${id}/reorder`, {
    method: "POST",
    body: JSON.stringify({ player_ids: playerIds }),
  });
}

export function markAbsent(
  id: string,
  waitlistPlayerId: string,
  teamId?: string,
) {
  return request(`/waitlist/${id}/mark-absent`, {
    method: "POST",
    body: JSON.stringify({ waitlist_player_id: waitlistPlayerId, team_id: teamId }),
  });
}

export function markPresent(id: string, waitlistPlayerId: string) {
  return request(`/waitlist/${id}/mark-present`, {
    method: "POST",
    body: JSON.stringify({ waitlist_player_id: waitlistPlayerId }),
  });
}

export function markLeft(
  id: string,
  waitlistPlayerId: string,
  teamId?: string,
) {
  return request(`/waitlist/${id}/mark-left`, {
    method: "POST",
    body: JSON.stringify({ waitlist_player_id: waitlistPlayerId, team_id: teamId }),
  });
}

export function formTeam(id: string) {
  return request(`/waitlist/${id}/form-team`, { method: "POST" });
}

export function updateTeam(
  teamId: string,
  body: { color?: string },
) {
  return request(`/teams/${teamId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function addPlayer(
  id: string,
  body: { user_id?: string; first_name?: string; last_name?: string },
) {
  return request(`/waitlist/${id}/add-player`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Staff - Games
export function createGame(
  waitlistId: string,
  team1Id: string,
  team2Id: string,
) {
  return request("/games", {
    method: "POST",
    body: JSON.stringify({
      waitlist_id: waitlistId,
      team1_id: team1Id,
      team2_id: team2Id,
    }),
  });
}

export function getGame(id: string) {
  return request(`/games/${id}`);
}

export function completeGame(id: string, winnerId: string) {
  return request<{
    game_id: string;
    winner_id: string;
    losing_team_id: string;
    streak: number;
    streak_maxed: boolean;
    players_needed: number;
  }>(`/games/${id}/complete`, {
    method: "POST",
    body: JSON.stringify({ winner_id: winnerId }),
  });
}

export function keepTeam(id: string, droppedUserIds?: string[]) {
  return request(`/games/${id}/keep-team`, {
    method: "POST",
    body: JSON.stringify({ dropped_user_ids: droppedUserIds }),
  });
}

export function nextGame(id: string, stayingTeamId?: string) {
  return request(`/games/${id}/next-game`, {
    method: "POST",
    body: JSON.stringify(stayingTeamId ? { staying_team_id: stayingTeamId } : {}),
  });
}
