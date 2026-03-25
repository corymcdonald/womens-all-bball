import { describe, it, expect, beforeEach } from "vitest";
import {
  MockDB,
  seedPlayers,
  formTeam,
  markTeamCompleted,
  markTeamStaged,
} from "./test-helpers";

let db: MockDB;

beforeEach(() => {
  db = new MockDB();
});

/**
 * These tests simulate what happens when checkAndAdvance runs concurrently
 * without locking — multiple calls see the same state and all try to act.
 */

describe("Concurrent checkAndAdvance (no lock)", () => {
  it("should demonstrate: 2 concurrent calls both see 0 staged teams and both form teams", () => {
    const wl = db.createWaitlist();
    seedPlayers(db, wl.id, 12);

    // Simulate 2 concurrent checkAndAdvance calls reading state at the same time
    // Both see: no active game, 0 staged teams, 12 waiting
    const waitingBefore = db.tables.waitlist_players.filter(
      (wp) => wp.waitlist_id === wl.id && wp.status === "waiting",
    ).length;
    expect(waitingBefore).toBe(12);

    const stagedBefore = db.getStagedTeams(wl.id).length;
    expect(stagedBefore).toBe(0);

    // Call 1 forms a team (takes first 5)
    const team1 = formTeam(db, wl.id, "White")!;
    expect(team1).not.toBeNull();

    // Call 2 ALSO forms a team — it read the same state before call 1 modified it
    // In reality this means call 2 would try to take the same 5 players
    // But since call 1 already transitioned them, call 2 takes the next 5
    const team2 = formTeam(db, wl.id, "Blue")!;
    expect(team2).not.toBeNull();

    // Now we have 2 staged teams — this is actually fine IF they stop here.
    // The problem is each call ALSO checks "2 staged? start game"
    // Call 1 sees 2 staged → creates game
    const game1 = db.createGame(wl.id, team1.id, team2.id);

    // Call 2 ALSO sees 2 staged (before call 1 transitioned them to playing)
    // and tries to create ANOTHER game — THIS IS THE BUG
    // In reality, the teams might already be in a game
    const game2 = db.createGame(wl.id, team1.id, team2.id);

    // Now we have 2 games with the same teams
    const activeGames = db.getActiveGames(wl.id);
    expect(activeGames).toHaveLength(2); // BUG: should be 1

    // This proves the race condition exists without locking
  });

  it("should demonstrate: 10 concurrent joins each trigger checkAndAdvance, creating chaos", () => {
    const wl = db.createWaitlist();

    // Pre-seed 5 players so we're 5 away from forming first team
    seedPlayers(db, wl.id, 5);

    // Now simulate 10 players joining concurrently
    // Each join triggers checkAndAdvance
    // Without locking, multiple checkAndAdvance calls run simultaneously

    // After all 10 join, we should have:
    // - 15 total players
    // - 2 teams formed (10 players), 1 game started
    // - 5 players remaining in queue

    // But without locking, we might get:
    // - 3+ teams formed
    // - Multiple games
    // - Same players on multiple teams

    const newPlayers = seedPlayers(db, wl.id, 10);

    // Simulate 3 concurrent checkAndAdvance calls that all read the same initial state:
    // Each sees: 0 staged, 0 active games, 15 waiting
    const snapshot = {
      staged: db.getStagedTeams(wl.id).length,
      active: db.getActiveGames(wl.id).length,
      waiting: db.tables.waitlist_players.filter(
        (wp) => wp.waitlist_id === wl.id && wp.status === "waiting",
      ).length,
    };

    expect(snapshot).toEqual({ staged: 0, active: 0, waiting: 15 });

    // All 3 calls decide to form teams
    const t1 = formTeam(db, wl.id, "White")!;
    const t2 = formTeam(db, wl.id, "Blue")!;
    const t3 = formTeam(db, wl.id, "White")!; // BUG: third team, duplicate color

    expect(t3).not.toBeNull(); // Proves 3rd team can form

    const staged = db.getStagedTeams(wl.id);
    expect(staged.length).toBeGreaterThan(2); // BUG: should never exceed 2
  });
});

describe("Correct behavior with serialized access", () => {
  it("should form exactly 2 teams and 1 game from 15 players", () => {
    const wl = db.createWaitlist();
    seedPlayers(db, wl.id, 15);

    // Serialized: first checkAndAdvance
    // Sees: 0 staged, 15 waiting → form team 1
    const t1 = formTeam(db, wl.id, "White")!;
    expect(db.getStagedTeams(wl.id)).toHaveLength(1);

    // Recurse: sees 1 staged, 10 waiting → form team 2
    const t2 = formTeam(db, wl.id, "Blue")!;
    expect(db.getStagedTeams(wl.id)).toHaveLength(2);

    // Recurse: sees 2 staged → start game
    t1.status = "playing";
    t2.status = "playing";
    db.createGame(wl.id, t1.id, t2.id);

    // Verify correct state
    expect(db.getActiveGames(wl.id)).toHaveLength(1);
    expect(db.getStagedTeams(wl.id)).toHaveLength(0);
    expect(
      db.tables.waitlist_players.filter(
        (wp) => wp.waitlist_id === wl.id && wp.status === "waiting",
      ).length,
    ).toBe(5);
  });

  it("should never have more than 1 active game per waitlist", () => {
    const wl = db.createWaitlist();
    seedPlayers(db, wl.id, 20);

    // Form and start game 1
    const t1 = formTeam(db, wl.id, "White")!;
    const t2 = formTeam(db, wl.id, "Blue")!;
    t1.status = "playing";
    t2.status = "playing";
    db.createGame(wl.id, t1.id, t2.id);

    // checkAndAdvance should see active game → do nothing
    const active = db.getActiveGames(wl.id);
    expect(active).toHaveLength(1);

    // Even though there are 10 more waiting, no more teams should form
    // (this is the guard at the top of checkAndAdvance)
    const staged = db.getStagedTeams(wl.id);
    expect(staged).toHaveLength(0);
  });

  it("after game complete, should form exactly 1 challenger team", () => {
    const wl = db.createWaitlist({ max_wins: 3 });
    seedPlayers(db, wl.id, 20);

    const t1 = formTeam(db, wl.id, "White")!;
    const t2 = formTeam(db, wl.id, "Blue")!;
    t1.status = "playing";
    t2.status = "playing";
    const game = db.createGame(wl.id, t1.id, t2.id);

    // White wins
    game.status = "completed";
    game.winner_id = t1.id;
    markTeamCompleted(db, wl.id, t2.id);
    markTeamStaged(db, t1.id); // Winner back to staged

    // checkAndAdvance: sees 1 staged (White), no active game, 10 waiting
    // Should form exactly 1 challenger (Blue)
    const t3 = formTeam(db, wl.id, "Blue")!;

    expect(db.getStagedTeams(wl.id)).toHaveLength(2);
    expect(db.getStagedColors(wl.id)).toContain("White");
    expect(db.getStagedColors(wl.id)).toContain("Blue");

    // Start game 2
    t1.status = "playing";
    t3.status = "playing";
    db.createGame(wl.id, t1.id, t3.id);

    expect(db.getActiveGames(wl.id)).toHaveLength(1);
    expect(db.getStagedTeams(wl.id)).toHaveLength(0);
  });
});

describe("Invariants that must hold", () => {
  it("at most 2 teams should ever be in staged or playing status", () => {
    const wl = db.createWaitlist();
    seedPlayers(db, wl.id, 25);

    // Correct flow through 3 games
    for (let gameNum = 0; gameNum < 3; gameNum++) {
      const staged = db.getStagedTeams(wl.id);
      const active = db.getActiveGames(wl.id);

      // Invariant: staged + playing teams <= 2
      const playingTeams = db.tables.teams.filter(
        (t) => t.waitlist_id === wl.id && t.status === "playing",
      );
      expect(staged.length + playingTeams.length).toBeLessThanOrEqual(2);

      // Invariant: at most 1 active game
      expect(active.length).toBeLessThanOrEqual(1);

      // Form teams if needed
      if (staged.length === 0 && active.length === 0) {
        const t1 = formTeam(db, wl.id, "White");
        const t2 = formTeam(db, wl.id, "Blue");
        if (!t1 || !t2) break;

        t1.status = "playing";
        t2.status = "playing";
        db.createGame(wl.id, t1.id, t2.id);
      }

      // Complete game
      const games = db.getActiveGames(wl.id);
      if (games.length > 0) {
        const game = games[0];
        game.status = "completed";
        game.winner_id = game.team1_id;

        const loser = db.tables.teams.find((t) => t.id === game.team2_id)!;
        const winner = db.tables.teams.find((t) => t.id === game.team1_id)!;

        markTeamCompleted(db, wl.id, loser.id);
        markTeamStaged(db, winner.id);
      }
    }
  });

  it("a player should never be on two staged/playing teams simultaneously", () => {
    const wl = db.createWaitlist();
    seedPlayers(db, wl.id, 15);

    const t1 = formTeam(db, wl.id, "White")!;
    const t2 = formTeam(db, wl.id, "Blue")!;

    // Check: no player appears on both teams
    const t1Players = new Set(db.getTeamPlayerIds(t1.id));
    const t2Players = db.getTeamPlayerIds(t2.id);

    for (const uid of t2Players) {
      expect(t1Players.has(uid)).toBe(false);
    }
  });
});
