import { getStoredUser } from "./user-store";
import type {
  User,
  Waitlist,
  WaitlistDetail,
  GameResult,
  GamesResponse,
  CompleteGameResult,
  JoinToken,
} from "./types";

const API_BASE = "/api";

// Re-export types that consumers import from api.ts
export type { GameResult, GamesResponse } from "./types";

// Clerk token getter — set by the app when a Clerk session is active
let _getClerkToken: (() => Promise<string | null>) | null = null;

export function setClerkTokenGetter(getter: () => Promise<string | null>) {
  _getClerkToken = getter;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const stored = await getStoredUser();
  const userId = stored ? JSON.parse(stored).id : null;

  // Get Clerk token if available (for admin-protected endpoints)
  const clerkToken = _getClerkToken ? await _getClerkToken() : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(userId ? { "x-user-id": userId } : {}),
    ...(clerkToken ? { Authorization: `Bearer ${clerkToken}` } : {}),
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

// ─── Users ───

export function getUser(id: string) {
  return request<User>(`/users/${id}`);
}

export function updateUser(
  id: string,
  body: {
    first_name?: string;
    last_name?: string;
    email?: string;
    role?: string;
  },
) {
  return request<User>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteUser(id: string) {
  return request(`/users/${id}`, { method: "DELETE" });
}

export function searchUsers(query: string) {
  return request<User[]>(`/users?q=${encodeURIComponent(query)}`);
}

export function listAdmins() {
  return request<User[]>("/users?role=admin");
}

export function promoteUser(id: string) {
  return updateUser(id, { role: "admin" });
}

export function registerUser(body: {
  first_name: string;
  last_name: string;
  email?: string;
  clerk_id?: string;
}) {
  return request<User>("/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getUserByClerkId(clerkId: string) {
  return request<User>(`/users?clerk_id=${encodeURIComponent(clerkId)}`);
}

export function linkClerkId(id: string, clerkId: string) {
  return request<User>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ clerk_id: clerkId }),
  });
}

// ─── Waitlists ───

export function createWaitlist(passcode?: string) {
  return request<Waitlist>("/waitlist", {
    method: "POST",
    body: JSON.stringify(passcode ? { passcode } : {}),
  });
}

export function listWaitlists() {
  return request<Waitlist[]>("/waitlist");
}

export function getWaitlist(id: string) {
  return request<WaitlistDetail>(`/waitlist/${id}`);
}

export function generateJoinToken(id: string) {
  return request<JoinToken>(`/waitlist/${id}/token`, { method: "POST" });
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
  return request(`/waitlist/${id}/join`, { method: "POST" });
}

// ─── Staff — Waitlist ───

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
    body: JSON.stringify({
      waitlist_player_id: waitlistPlayerId,
      team_id: teamId,
    }),
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
    body: JSON.stringify({
      waitlist_player_id: waitlistPlayerId,
      team_id: teamId,
    }),
  });
}

export function updateTeam(teamId: string, body: { color?: string }) {
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

// ─── Games ───

export function listGames(cursor?: string) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return request<GamesResponse>(`/games${qs ? `?${qs}` : ""}`);
}

export function getGame(id: string) {
  return request(`/games/${id}`);
}

export function completeGame(id: string, winnerId: string) {
  return request<CompleteGameResult>(`/games/${id}/complete`, {
    method: "POST",
    body: JSON.stringify({ winner_id: winnerId }),
  });
}
