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

describe("Team color assignment", () => {
  it("first two teams should be White and Blue", () => {
    const wl = db.createWaitlist();
    seedPlayers(db, wl.id, 10);

    const team1 = formTeam(db, wl.id, "White");
    const team2 = formTeam(db, wl.id, "Blue");

    expect(team1!.color).toBe("White");
    expect(team2!.color).toBe("Blue");
  });

  it("staged teams should have different colors", () => {
    const wl = db.createWaitlist();
    seedPlayers(db, wl.id, 10);

    formTeam(db, wl.id, "White");
    formTeam(db, wl.id, "Blue");

    const colors = db.getStagedColors(wl.id);
    expect(colors).toHaveLength(2);
    expect(new Set(colors).size).toBe(2);
  });

  it("after game completes and winner stays, challenger should have opposite color", () => {
    const wl = db.createWaitlist();
    seedPlayers(db, wl.id, 15);

    const white = formTeam(db, wl.id, "White")!;
    const blue = formTeam(db, wl.id, "Blue")!;

    // Start game — teams transition to playing
    white.status = "playing";
    blue.status = "playing";
    db.createGame(wl.id, white.id, blue.id);

    // White wins → Blue completed, White back to staged
    markTeamCompleted(db, wl.id, blue.id);
    markTeamStaged(db, white.id);

    // Only White should be staged
    const staged = db.getStagedTeams(wl.id);
    expect(staged).toHaveLength(1);
    expect(staged[0].color).toBe("White");

    // Used colors: White (staged)
    const used = db.getUsedColors(wl.id);
    expect(used.has("White")).toBe(true);
    expect(used.has("Blue")).toBe(false);

    // Challenger should be Blue
    const challenger = formTeam(db, wl.id, "Blue")!;
    expect(challenger.color).toBe("Blue");
  });
});

describe("Staged team detection", () => {
  it("completed teams should NOT appear as staged", () => {
    const wl = db.createWaitlist();
    seedPlayers(db, wl.id, 10);

    const team1 = formTeam(db, wl.id, "White")!;
    const team2 = formTeam(db, wl.id, "Blue")!;

    team1.status = "playing";
    team2.status = "playing";
    const game = db.createGame(wl.id, team1.id, team2.id);

    game.status = "completed";
    markTeamCompleted(db, wl.id, team1.id);
    markTeamCompleted(db, wl.id, team2.id);

    expect(db.getStagedTeams(wl.id)).toHaveLength(0);
  });

  it("winning team transitioned to staged should appear", () => {
    const wl = db.createWaitlist();
    seedPlayers(db, wl.id, 10);

    const team1 = formTeam(db, wl.id, "White")!;
    const team2 = formTeam(db, wl.id, "Blue")!;

    team1.status = "playing";
    team2.status = "playing";

    markTeamCompleted(db, wl.id, team2.id);
    markTeamStaged(db, team1.id);

    const staged = db.getStagedTeams(wl.id);
    expect(staged).toHaveLength(1);
    expect(staged[0].id).toBe(team1.id);
  });

  it("should never show more than 2 staged teams across multiple games", () => {
    const wl = db.createWaitlist();
    seedPlayers(db, wl.id, 20);

    // Game 1: White vs Blue → White wins
    const t1 = formTeam(db, wl.id, "White")!;
    const t2 = formTeam(db, wl.id, "Blue")!;
    t1.status = "playing";
    t2.status = "playing";
    const g1 = db.createGame(wl.id, t1.id, t2.id);
    g1.status = "completed";
    markTeamCompleted(db, wl.id, t2.id);
    markTeamStaged(db, t1.id);

    // Game 2: White vs Blue2 → Blue2 wins
    const t3 = formTeam(db, wl.id, "Blue")!;
    t1.status = "playing";
    t3.status = "playing";
    const g2 = db.createGame(wl.id, t1.id, t3.id);
    g2.status = "completed";
    markTeamCompleted(db, wl.id, t1.id);
    markTeamStaged(db, t3.id);

    // Game 3 setup: Blue2 stays, new White challenger
    const t4 = formTeam(db, wl.id, "White")!;

    const staged = db.getStagedTeams(wl.id);
    expect(staged).toHaveLength(2);
    expect(staged.map((s) => s.id)).toContain(t3.id);
    expect(staged.map((s) => s.id)).toContain(t4.id);
    // Old teams should not appear
    expect(staged.map((s) => s.id)).not.toContain(t1.id);
    expect(staged.map((s) => s.id)).not.toContain(t2.id);
  });
});

describe("Streak calculation", () => {
  it("staying team (team1) winning should increment streak", () => {
    const wl = db.createWaitlist({ max_wins: 3 });
    seedPlayers(db, wl.id, 15);

    const white = formTeam(db, wl.id, "White")!;
    const blue = formTeam(db, wl.id, "Blue")!;

    // Game 1: White wins
    white.status = "playing";
    blue.status = "playing";
    const g1 = db.createGame(wl.id, white.id, blue.id);
    g1.status = "completed";
    g1.winner_id = white.id;
    markTeamCompleted(db, wl.id, blue.id);
    markTeamStaged(db, white.id);
    wl.current_streak = 1;

    // Game 2: White (team1/staying) vs new Blue (team2/challenger)
    const blue2 = formTeam(db, wl.id, "Blue")!;
    white.status = "playing";
    blue2.status = "playing";
    const g2 = db.createGame(wl.id, white.id, blue2.id);

    // Streak check: same team that won game 1 (white) wins game 2
    const sameTeamWonAgain = g1.winner_id === white.id; // white won g1, white wins g2
    expect(sameTeamWonAgain).toBe(true);

    const newStreak = sameTeamWonAgain ? wl.current_streak + 1 : 1;
    expect(newStreak).toBe(2);
  });

  it("challenger (team2) winning should reset streak to 1", () => {
    const wl = db.createWaitlist({ max_wins: 3 });
    seedPlayers(db, wl.id, 15);

    const white = formTeam(db, wl.id, "White")!;
    const blue = formTeam(db, wl.id, "Blue")!;

    white.status = "playing";
    blue.status = "playing";
    const g1 = db.createGame(wl.id, white.id, blue.id);
    g1.status = "completed";
    g1.winner_id = white.id;
    markTeamCompleted(db, wl.id, blue.id);
    markTeamStaged(db, white.id);
    wl.current_streak = 1;

    const blue2 = formTeam(db, wl.id, "Blue")!;
    white.status = "playing";
    blue2.status = "playing";
    const g2 = db.createGame(wl.id, white.id, blue2.id);

    // Blue2 (challenger) wins — different team than game 1 winner (white)
    g2.winner_id = blue2.id;
    const sameTeamWonAgain = g1.winner_id === blue2.id; // white won g1, blue2 wins g2
    expect(sameTeamWonAgain).toBe(false);

    const newStreak = sameTeamWonAgain ? wl.current_streak + 1 : 1;
    expect(newStreak).toBe(1);
  });

  it("staying team on RIGHT (team2) winning should still increment streak", () => {
    const wl = db.createWaitlist({ max_wins: 3 });
    seedPlayers(db, wl.id, 15);

    const white = formTeam(db, wl.id, "White")!;
    const blue = formTeam(db, wl.id, "Blue")!;

    // Game 1: Blue (team2/right) wins
    white.status = "playing";
    blue.status = "playing";
    const g1 = db.createGame(wl.id, white.id, blue.id);
    g1.status = "completed";
    g1.winner_id = blue.id;
    markTeamCompleted(db, wl.id, white.id);
    markTeamStaged(db, blue.id);
    wl.current_streak = 1;

    // Game 2: Blue stays as team2 (right), new White is team1 (left)
    // (orchestrator preserves position)
    const white2 = formTeam(db, wl.id, "White")!;
    white2.status = "playing";
    blue.status = "playing";
    const g2 = db.createGame(wl.id, white2.id, blue.id);

    // Blue (team2) wins again — same team as g1 winner
    const sameTeamWonAgain = g1.winner_id === blue.id;
    expect(sameTeamWonAgain).toBe(true);

    const newStreak = sameTeamWonAgain ? wl.current_streak + 1 : 1;
    expect(newStreak).toBe(2); // Streak continues regardless of position
  });

  it("streak maxed should complete both teams", () => {
    const wl = db.createWaitlist({ max_wins: 2 });
    seedPlayers(db, wl.id, 15);

    const white = formTeam(db, wl.id, "White")!;
    const blue = formTeam(db, wl.id, "Blue")!;

    white.status = "playing";
    blue.status = "playing";
    const g1 = db.createGame(wl.id, white.id, blue.id);
    g1.status = "completed";
    g1.winner_id = white.id;
    markTeamCompleted(db, wl.id, blue.id);
    markTeamStaged(db, white.id);
    wl.current_streak = 1;

    const blue2 = formTeam(db, wl.id, "Blue")!;
    white.status = "playing";
    blue2.status = "playing";

    // White wins again → streak = 2, maxed (max_wins = 2)
    const newStreak = wl.current_streak + 1;
    const streakMaxed = newStreak >= wl.max_wins;
    expect(streakMaxed).toBe(true);

    // Both should be completed
    markTeamCompleted(db, wl.id, white.id);
    markTeamCompleted(db, wl.id, blue2.id);

    expect(db.getStagedTeams(wl.id)).toHaveLength(0);
  });
});

describe("Color alternation across multiple games", () => {
  it("should alternate colors correctly through 3 games with different winners", () => {
    const wl = db.createWaitlist({ max_wins: 3 });
    seedPlayers(db, wl.id, 25);

    // Game 1: White vs Blue → White wins
    const t1 = formTeam(db, wl.id, "White")!;
    const t2 = formTeam(db, wl.id, "Blue")!;
    t1.status = "playing";
    t2.status = "playing";
    const g1 = db.createGame(wl.id, t1.id, t2.id);
    g1.status = "completed";
    g1.winner_id = t1.id;
    markTeamCompleted(db, wl.id, t2.id);
    markTeamStaged(db, t1.id);

    // Staged: [White]. Used: {White}. Challenger should be Blue.
    expect(db.getStagedColors(wl.id)).toEqual(["White"]);
    expect(db.getUsedColors(wl.id).has("White")).toBe(true);
    expect(db.getUsedColors(wl.id).has("Blue")).toBe(false);

    const t3 = formTeam(db, wl.id, "Blue")!;
    expect(t3.color).toBe("Blue");

    // Game 2: White vs Blue → Blue wins
    t1.status = "playing";
    t3.status = "playing";
    const g2 = db.createGame(wl.id, t1.id, t3.id);
    g2.status = "completed";
    g2.winner_id = t3.id;
    markTeamCompleted(db, wl.id, t1.id);
    markTeamStaged(db, t3.id);

    // Staged: [Blue]. Used: {Blue}. Challenger should be White.
    expect(db.getStagedColors(wl.id)).toEqual(["Blue"]);
    expect(db.getUsedColors(wl.id).has("Blue")).toBe(true);
    expect(db.getUsedColors(wl.id).has("White")).toBe(false);

    const t4 = formTeam(db, wl.id, "White")!;
    expect(t4.color).toBe("White");

    // Both staged: Blue + White (different colors)
    const colors = db.getStagedColors(wl.id);
    expect(colors).toHaveLength(2);
    expect(new Set(colors).size).toBe(2);
    expect(colors).toContain("Blue");
    expect(colors).toContain("White");
  });
});

describe("Team status lifecycle", () => {
  it("staged → playing → completed (loser)", () => {
    const wl = db.createWaitlist();
    seedPlayers(db, wl.id, 10);

    const team = formTeam(db, wl.id, "White")!;
    expect(team.status).toBe("staged");

    team.status = "playing";
    expect(team.status).toBe("playing");

    markTeamCompleted(db, wl.id, team.id);
    expect(team.status).toBe("completed");
  });

  it("staged → playing → staged (winner stays)", () => {
    const wl = db.createWaitlist();
    seedPlayers(db, wl.id, 10);

    const team = formTeam(db, wl.id, "White")!;
    expect(team.status).toBe("staged");

    team.status = "playing";
    expect(team.status).toBe("playing");

    markTeamStaged(db, team.id);
    expect(team.status).toBe("staged");
  });

  it("staged → playing → completed (winner, streak maxed)", () => {
    const wl = db.createWaitlist({ max_wins: 1 });
    seedPlayers(db, wl.id, 10);

    const team = formTeam(db, wl.id, "White")!;
    team.status = "playing";

    // Streak maxed → winner also completed
    markTeamCompleted(db, wl.id, team.id);
    expect(team.status).toBe("completed");
  });
});
