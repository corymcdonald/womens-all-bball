/**
 * In-memory database for testing services without Supabase.
 * Mimics the data model with teams.status for direct state tracking.
 */

type Row = {
  id: string;
  [key: string]: unknown;
};

export class MockDB {
  tables: Record<string, Row[]> = {
    users: [],
    waitlists: [],
    waitlist_players: [],
    teams: [],
    team_players: [],
    games: [],
  };

  private idCounter = 0;

  nextId(): string {
    this.idCounter++;
    return `test-id-${this.idCounter}`;
  }

  reset() {
    for (const key of Object.keys(this.tables)) {
      this.tables[key] = [];
    }
    this.idCounter = 0;
  }

  createUser(overrides: Partial<Row> = {}): Row {
    const user = {
      id: this.nextId(),
      first_name: "Test",
      last_name: "User",
      email: null,
      role: "player",
      created_at: new Date().toISOString(),
      ...overrides,
    };
    this.tables.users.push(user);
    return user;
  }

  createWaitlist(overrides: Partial<Row> = {}): Row {
    const wl = {
      id: this.nextId(),
      passcode: "TEST",
      max_wins: 2,
      game_duration_minutes: 5,
      current_streak: 0,
      created_at: new Date().toISOString(),
      ...overrides,
    };
    this.tables.waitlists.push(wl);
    return wl;
  }

  addPlayerToQueue(
    waitlistId: string,
    userId: string,
    status = "waiting",
  ): Row {
    const wp = {
      id: this.nextId(),
      waitlist_id: waitlistId,
      user_id: userId,
      priority: null,
      status,
      created_at: new Date().toISOString(),
    };
    this.tables.waitlist_players.push(wp);
    return wp;
  }

  createTeam(
    waitlistId: string,
    color: string,
    status: "staged" | "playing" | "completed" = "staged",
  ): Row {
    const team = {
      id: this.nextId(),
      waitlist_id: waitlistId,
      color,
      status,
      created_at: new Date().toISOString(),
    };
    this.tables.teams.push(team);
    return team;
  }

  addPlayerToTeam(teamId: string, userId: string): Row {
    const tp = {
      id: this.nextId(),
      team_id: teamId,
      user_id: userId,
      created_at: new Date().toISOString(),
    };
    this.tables.team_players.push(tp);
    return tp;
  }

  createGame(
    waitlistId: string,
    team1Id: string,
    team2Id: string,
    status = "in_progress",
    winnerId: string | null = null,
  ): Row {
    const wl = this.tables.waitlists.find((w) => w.id === waitlistId);
    const game = {
      id: this.nextId(),
      waitlist_id: waitlistId,
      team1_id: team1Id,
      team2_id: team2Id,
      winner_id: winnerId,
      status,
      max_wins: wl?.max_wins ?? 2,
      game_duration_minutes: wl?.game_duration_minutes ?? 5,
      created_at: new Date().toISOString(),
    };
    this.tables.games.push(game);
    return game;
  }

  // ─── Query helpers ───

  getStagedTeams(waitlistId: string): Row[] {
    return this.tables.teams
      .filter((t) => t.waitlist_id === waitlistId && t.status === "staged")
      .sort(
        (a, b) =>
          new Date(a.created_at as string).getTime() -
          new Date(b.created_at as string).getTime(),
      );
  }

  getStagedColors(waitlistId: string): string[] {
    return this.getStagedTeams(waitlistId).map((t) => t.color as string);
  }

  getUsedColors(waitlistId: string): Set<string> {
    return new Set(
      this.tables.teams
        .filter(
          (t) =>
            t.waitlist_id === waitlistId &&
            (t.status === "staged" || t.status === "playing"),
        )
        .map((t) => t.color as string),
    );
  }

  getActiveGames(waitlistId: string): Row[] {
    return this.tables.games.filter(
      (g) => g.waitlist_id === waitlistId && g.status === "in_progress",
    );
  }

  getCompletedGames(waitlistId: string): Row[] {
    return this.tables.games
      .filter((g) => g.waitlist_id === waitlistId && g.status === "completed")
      .sort(
        (a, b) =>
          new Date(b.created_at as string).getTime() -
          new Date(a.created_at as string).getTime(),
      );
  }

  getTeamPlayerIds(teamId: string): string[] {
    return this.tables.team_players
      .filter((tp) => tp.team_id === teamId)
      .map((tp) => tp.user_id as string);
  }
}

/**
 * Seed N users and add them to a waitlist as "waiting".
 */
export function seedPlayers(
  db: MockDB,
  waitlistId: string,
  count: number,
): { users: Row[]; waitlistPlayers: Row[] } {
  const users: Row[] = [];
  const waitlistPlayers: Row[] = [];

  for (let i = 0; i < count; i++) {
    const user = db.createUser({
      first_name: `Player${i + 1}`,
      last_name: "Test",
    });
    users.push(user);
    waitlistPlayers.push(db.addPlayerToQueue(waitlistId, user.id));
  }

  return { users, waitlistPlayers };
}

/**
 * Form a team from the top 5 waiting players. Sets team status to 'staged'.
 */
export function formTeam(
  db: MockDB,
  waitlistId: string,
  color: string,
): Row | null {
  const waiting = db.tables.waitlist_players
    .filter((wp) => wp.waitlist_id === waitlistId && wp.status === "waiting")
    .sort(
      (a, b) =>
        new Date(a.created_at as string).getTime() -
        new Date(b.created_at as string).getTime(),
    );

  if (waiting.length < 5) return null;

  const team = db.createTeam(waitlistId, color, "staged");

  for (const wp of waiting.slice(0, 5)) {
    db.addPlayerToTeam(team.id, wp.user_id as string);
    wp.status = "playing";
  }

  return team;
}

/**
 * Mark a team and its players as completed.
 */
export function markTeamCompleted(
  db: MockDB,
  waitlistId: string,
  teamId: string,
) {
  const team = db.tables.teams.find((t) => t.id === teamId);
  if (team) team.status = "completed";

  const playerIds = db.getTeamPlayerIds(teamId);
  for (const uid of playerIds) {
    const wp = db.tables.waitlist_players.find(
      (w) =>
        w.waitlist_id === waitlistId &&
        w.user_id === uid &&
        w.status === "playing",
    );
    if (wp) wp.status = "completed";
  }
}

/**
 * Transition a winning team back to 'staged' (staying on for next game).
 */
export function markTeamStaged(db: MockDB, teamId: string) {
  const team = db.tables.teams.find((t) => t.id === teamId);
  if (team) team.status = "staged";
}

/**
 * Get the next waiting player from the queue (oldest first, excluding absent).
 */
export function getNextWaiting(db: MockDB, waitlistId: string): Row | null {
  const waiting = db.tables.waitlist_players
    .filter((wp) => wp.waitlist_id === waitlistId && wp.status === "waiting")
    .sort(
      (a, b) =>
        new Date(a.created_at as string).getTime() -
        new Date(b.created_at as string).getTime(),
    );
  return waiting[0] ?? null;
}

/**
 * Swap a player off a team. Finds replacement BEFORE transitioning the
 * removed player to "waiting" to prevent the auto-draft bug where the
 * removed player is selected as their own replacement.
 */
export function swapPlayerOffTeam(
  db: MockDB,
  waitlistId: string,
  teamId: string,
  userId: string,
  replacementUserId?: string,
): { removedUserId: string; replacementUserId: string | null } {
  // Find replacement BEFORE removing (the fix for the auto-draft bug)
  const replacement = replacementUserId
    ? db.tables.waitlist_players.find(
        (wp) =>
          wp.waitlist_id === waitlistId &&
          wp.user_id === replacementUserId &&
          wp.status === "waiting",
      )
    : getNextWaiting(db, waitlistId);

  // Remove from team
  const tpIndex = db.tables.team_players.findIndex(
    (tp) => tp.team_id === teamId && tp.user_id === userId,
  );
  if (tpIndex !== -1) db.tables.team_players.splice(tpIndex, 1);

  // Transition removed player: playing → waiting
  const wp = db.tables.waitlist_players.find(
    (w) =>
      w.waitlist_id === waitlistId &&
      w.user_id === userId &&
      w.status === "playing",
  );
  if (wp) wp.status = "waiting";

  // Add replacement to team
  if (replacement) {
    replacement.status = "playing";
    db.addPlayerToTeam(teamId, replacement.user_id as string);
    return { removedUserId: userId, replacementUserId: replacement.user_id as string };
  }

  return { removedUserId: userId, replacementUserId: null };
}

/**
 * Buggy version of swap: finds replacement AFTER transitioning, which
 * allows the removed player to be drafted as their own replacement.
 */
export function swapPlayerOffTeamBuggy(
  db: MockDB,
  waitlistId: string,
  teamId: string,
  userId: string,
): { removedUserId: string; replacementUserId: string | null } {
  // Remove from team
  const tpIndex = db.tables.team_players.findIndex(
    (tp) => tp.team_id === teamId && tp.user_id === userId,
  );
  if (tpIndex !== -1) db.tables.team_players.splice(tpIndex, 1);

  // Transition removed player: playing → waiting (BUG: done BEFORE finding replacement)
  const wp = db.tables.waitlist_players.find(
    (w) =>
      w.waitlist_id === waitlistId &&
      w.user_id === userId &&
      w.status === "playing",
  );
  if (wp) wp.status = "waiting";

  // Find replacement AFTER removing — BUG: removed player is now "waiting"
  const replacement = getNextWaiting(db, waitlistId);

  if (replacement) {
    replacement.status = "playing";
    db.addPlayerToTeam(teamId, replacement.user_id as string);
    return { removedUserId: userId, replacementUserId: replacement.user_id as string };
  }

  return { removedUserId: userId, replacementUserId: null };
}
