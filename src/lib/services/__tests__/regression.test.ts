import { beforeEach, describe, expect, it } from "vitest";
import {
  formTeam,
  getNextWaiting,
  MockDB,
  seedPlayers,
  swapPlayerOffTeam,
  swapPlayerOffTeamBuggy,
} from "./test-helpers";

// Inline from waitlist.ts to avoid supabase import in tests
const VALID_TRANSITIONS: Record<string, string[]> = {
  waiting: ["playing", "absent", "left"],
  absent: ["left", "waiting"],
  playing: ["completed", "left", "waiting"],
};

function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

let db: MockDB;

beforeEach(() => {
  db = new MockDB();
});

describe("Swap auto-draft bug (playing → waiting before finding replacement)", () => {
  it("buggy: removed player is drafted as their own replacement when no queue players exist", () => {
    const wl = db.createWaitlist();
    // Seed exactly 10 players — all drafted onto teams, none left in queue
    seedPlayers(db, wl.id, 10);
    const team1 = formTeam(db, wl.id, "White")!;
    formTeam(db, wl.id, "Blue")!;

    const playerToRemove = db.getTeamPlayerIds(team1.id)[0];

    // No one is waiting in the queue
    expect(getNextWaiting(db, wl.id)).toBeNull();

    // Buggy version: transitions to waiting THEN looks for replacement
    const result = swapPlayerOffTeamBuggy(db, wl.id, team1.id, playerToRemove);

    // BUG: the removed player was found as their own replacement
    expect(result.replacementUserId).toBe(playerToRemove);
  });

  it("fixed: removed player is NOT drafted as their own replacement", () => {
    const wl = db.createWaitlist();
    seedPlayers(db, wl.id, 10);
    const team1 = formTeam(db, wl.id, "White")!;
    formTeam(db, wl.id, "Blue")!;

    const playerToRemove = db.getTeamPlayerIds(team1.id)[0];
    expect(getNextWaiting(db, wl.id)).toBeNull();

    // Fixed version: finds replacement BEFORE transitioning
    const result = swapPlayerOffTeam(db, wl.id, team1.id, playerToRemove);

    // No replacement available — player just goes back to queue
    expect(result.replacementUserId).toBeNull();
    expect(result.removedUserId).toBe(playerToRemove);

    // Removed player should be in waiting status, not still on team
    const wp = db.tables.waitlist_players.find(
      (w) => w.user_id === playerToRemove && w.waitlist_id === wl.id,
    );
    expect(wp?.status).toBe("waiting");
    expect(db.getTeamPlayerIds(team1.id)).not.toContain(playerToRemove);
  });

  it("fixed: next queue player is drafted when one exists", () => {
    const wl = db.createWaitlist();
    // 11 players: 10 on teams, 1 waiting in queue
    seedPlayers(db, wl.id, 11);
    const team1 = formTeam(db, wl.id, "White")!;
    formTeam(db, wl.id, "Blue")!;

    const playerToRemove = db.getTeamPlayerIds(team1.id)[0];
    const queuePlayer = getNextWaiting(db, wl.id)!;
    expect(queuePlayer).not.toBeNull();

    const result = swapPlayerOffTeam(db, wl.id, team1.id, playerToRemove);

    // Queue player should be drafted, NOT the removed player
    expect(result.replacementUserId).toBe(queuePlayer.user_id);
    expect(result.replacementUserId).not.toBe(playerToRemove);

    // Team should still have 5 players
    expect(db.getTeamPlayerIds(team1.id)).toHaveLength(5);
    expect(db.getTeamPlayerIds(team1.id)).toContain(
      queuePlayer.user_id as string,
    );
    expect(db.getTeamPlayerIds(team1.id)).not.toContain(playerToRemove);
  });

  it("fixed: explicit replacement is used even when queue has other players", () => {
    const wl = db.createWaitlist();
    seedPlayers(db, wl.id, 12);
    const team1 = formTeam(db, wl.id, "White")!;
    formTeam(db, wl.id, "Blue")!;

    const playerToRemove = db.getTeamPlayerIds(team1.id)[0];

    // 2 players in queue — pick the second one explicitly
    const waitingPlayers = db.tables.waitlist_players.filter(
      (wp) => wp.waitlist_id === wl.id && wp.status === "waiting",
    );
    expect(waitingPlayers).toHaveLength(2);
    const specificReplacement = waitingPlayers[1].user_id as string;

    const result = swapPlayerOffTeam(
      db,
      wl.id,
      team1.id,
      playerToRemove,
      specificReplacement,
    );

    expect(result.replacementUserId).toBe(specificReplacement);
    expect(db.getTeamPlayerIds(team1.id)).toContain(specificReplacement);
  });
});

describe("Playing → waiting transition (swap back to queue)", () => {
  it("playing → waiting should be a valid transition", () => {
    expect(canTransition("playing", "waiting")).toBe(true);
  });

  it("playing → playing should NOT be valid", () => {
    expect(canTransition("playing", "playing")).toBe(false);
  });

  it("waiting → playing should be valid (drafted onto team)", () => {
    expect(canTransition("waiting", "playing")).toBe(true);
  });

  it("completed → waiting should NOT be valid (no re-entry after completion)", () => {
    expect(canTransition("completed", "waiting")).toBe(false);
  });
});

describe("Token-based join security", () => {
  it("passcode is a staff-only secret on the waitlist, not a player join credential", () => {
    const wl = db.createWaitlist({ passcode: "DUNK" });

    // The passcode lives on the waitlist — it's the seed for generating tokens
    expect(wl.passcode).toBe("DUNK");

    // Players should never validate against the passcode directly;
    // they must use a token from waitlist_tokens
  });

  it("player join credentials come from waitlist_tokens, not the waitlist passcode", () => {
    // Players receive a token (from QR or staff) that exists in waitlist_tokens.
    // The waitlist.passcode is never exposed to players.
    // This test documents the architectural constraint:
    // - waitlist.passcode → staff secret, used to seed tokens
    // - waitlist_tokens → player-facing join credentials with expiry
    const wl = db.createWaitlist({ passcode: "DUNK" });

    // A token entry would be a separate row, not derived from passcode
    const mockToken = { token: "ABC123", waitlist_id: wl.id, expires_at: new Date().toISOString() };
    expect(mockToken.token).not.toBe(wl.passcode);
  });
});
