import { beforeEach, describe, expect, it } from "vitest";
import { MockDB, seedPlayers, formTeam } from "./test-helpers";

/**
 * Compute what the client UI would see at the current DB state,
 * mirroring what getWaitlistDetail returns.
 */
function getVisibleState(db: MockDB, waitlistId: string) {
  const queue = db.tables.waitlist_players.filter(
    (wp) =>
      wp.waitlist_id === waitlistId &&
      (wp.status === "waiting" || wp.status === "absent"),
  );

  const stagedTeams = db.tables.teams
    .filter((t) => t.waitlist_id === waitlistId && t.status === "staged")
    .map((t) => ({
      id: t.id,
      color: t.color,
      playerIds: db.getTeamPlayerIds(t.id),
    }));

  const activeGames = db.getActiveGames(waitlistId);
  const activeGame =
    activeGames.length > 0
      ? {
          id: activeGames[0].id,
          team1PlayerIds: db.getTeamPlayerIds(activeGames[0].team1_id as string),
          team2PlayerIds: db.getTeamPlayerIds(activeGames[0].team2_id as string),
        }
      : null;

  const playingPlayerIds = new Set([
    ...stagedTeams.flatMap((t) => t.playerIds),
    ...(activeGame
      ? [...activeGame.team1PlayerIds, ...activeGame.team2PlayerIds]
      : []),
  ]);

  const queuePlayerIds = queue.map((wp) => wp.user_id);

  return {
    queueCount: queue.length,
    queuePlayerIds,
    stagedTeamCount: stagedTeams.length,
    stagedTeams,
    activeGame,
    playingPlayerIds,
    totalVisible: queue.length + playingPlayerIds.size,
  };
}

/**
 * Assert that every player who has joined and not left/completed
 * is visible somewhere in the UI (queue, staged team, or active game).
 */
function assertAllPlayersVisible(
  db: MockDB,
  waitlistId: string,
  label: string,
) {
  const state = getVisibleState(db, waitlistId);

  const activePlayers = db.tables.waitlist_players.filter(
    (wp) =>
      wp.waitlist_id === waitlistId &&
      wp.status !== "completed" &&
      wp.status !== "left",
  );

  const visibleUserIds = new Set([
    ...state.queuePlayerIds,
    ...state.playingPlayerIds,
  ]);

  for (const player of activePlayers) {
    expect(
      visibleUserIds.has(player.user_id),
      `[${label}] Player ${player.user_id} (status=${player.status}) is not visible anywhere in the UI`,
    ).toBe(true);
  }

  return state;
}

let db: MockDB;

beforeEach(() => {
  db = new MockDB();
});

describe("No-flash: players never disappear during join flow", () => {
  it("5 players join one by one — at every observable state, all players are visible", () => {
    const wl = db.createWaitlist();
    const snapshots: ReturnType<typeof getVisibleState>[] = [];

    for (let i = 0; i < 5; i++) {
      const user = db.createUser({
        first_name: `Player${i + 1}`,
        last_name: "Test",
      });
      db.addPlayerToQueue(wl.id, user.id);

      // EVENT: "updated" fires after addToQueue, BEFORE checkAndAdvance
      // Client refetches here — this is the snapshot that causes the flash
      const stateAtUpdatedEvent = assertAllPlayersVisible(
        db,
        wl.id,
        `after player ${i + 1} joins (updated event)`,
      );
      snapshots.push(stateAtUpdatedEvent);
    }

    // At the "updated" event for the 5th player, all 5 should be in queue
    expect(snapshots[4].queueCount).toBe(5);
    expect(snapshots[4].stagedTeamCount).toBe(0);

    // NOW simulate what checkAndAdvance does: form a team
    // This moves 5 players from queue (waiting→playing) into a staged team
    const team1 = formTeam(db, wl.id, "White")!;
    expect(team1).not.toBeNull();

    // EVENT: "team:formed" fires — client refetches
    const stateAfterTeamFormed = assertAllPlayersVisible(
      db,
      wl.id,
      "after team formed (team:formed event)",
    );

    // All 5 players should now be in staged team, 0 in queue
    expect(stateAfterTeamFormed.queueCount).toBe(0);
    expect(stateAfterTeamFormed.stagedTeamCount).toBe(1);
    expect(stateAfterTeamFormed.totalVisible).toBe(5);
  });

  it("10 players join — demonstrates the flash problem between events", () => {
    const wl = db.createWaitlist();
    const eventSnapshots: {
      label: string;
      state: ReturnType<typeof getVisibleState>;
    }[] = [];

    // Add 10 players to queue
    for (let i = 0; i < 10; i++) {
      const user = db.createUser({
        first_name: `Player${i + 1}`,
        last_name: "Test",
      });
      db.addPlayerToQueue(wl.id, user.id);
    }

    // Simulate what happens when the 5th player's joinAndAdvance runs:
    // 1. "updated" event fires — client sees 5 in queue (but we have 10 now for simplicity)
    eventSnapshots.push({
      label: "before any team formation",
      state: assertAllPlayersVisible(db, wl.id, "before team formation"),
    });

    expect(eventSnapshots[0].state.queueCount).toBe(10);
    expect(eventSnapshots[0].state.totalVisible).toBe(10);

    // 2. checkAndAdvance forms team 1
    const team1 = formTeam(db, wl.id, "White")!;
    eventSnapshots.push({
      label: "after team 1 formed",
      state: assertAllPlayersVisible(db, wl.id, "after team 1 formed"),
    });

    // 5 in queue + 5 in staged team = 10 total
    expect(eventSnapshots[1].state.queueCount).toBe(5);
    expect(eventSnapshots[1].state.stagedTeamCount).toBe(1);
    expect(eventSnapshots[1].state.totalVisible).toBe(10);

    // 3. advance recurses, forms team 2
    const team2 = formTeam(db, wl.id, "Blue")!;
    eventSnapshots.push({
      label: "after team 2 formed",
      state: assertAllPlayersVisible(db, wl.id, "after team 2 formed"),
    });

    // 0 in queue + 10 in staged teams = 10 total
    expect(eventSnapshots[2].state.queueCount).toBe(0);
    expect(eventSnapshots[2].state.stagedTeamCount).toBe(2);
    expect(eventSnapshots[2].state.totalVisible).toBe(10);

    // 4. advance recurses, starts game (2 staged teams)
    team1.status = "playing";
    team2.status = "playing";
    db.createGame(wl.id, team1.id, team2.id);

    eventSnapshots.push({
      label: "after game started",
      state: assertAllPlayersVisible(db, wl.id, "after game started"),
    });

    expect(eventSnapshots[3].state.activeGame).not.toBeNull();
    expect(eventSnapshots[3].state.totalVisible).toBe(10);

    // CRITICAL: total visible players should NEVER drop across all snapshots
    for (let i = 1; i < eventSnapshots.length; i++) {
      expect(
        eventSnapshots[i].state.totalVisible,
        `Total visible dropped from ${eventSnapshots[i - 1].state.totalVisible} to ${eventSnapshots[i].state.totalVisible} between "${eventSnapshots[i - 1].label}" and "${eventSnapshots[i].label}"`,
      ).toBeGreaterThanOrEqual(eventSnapshots[i - 1].state.totalVisible);
    }
  });

  it("simulates the exact flash bug: updated event fires before team formation", () => {
    const wl = db.createWaitlist();

    // Add 4 players — all fine
    for (let i = 0; i < 4; i++) {
      const user = db.createUser({
        first_name: `Player${i + 1}`,
        last_name: "Test",
      });
      db.addPlayerToQueue(wl.id, user.id);
    }

    const stateBefore5th = getVisibleState(db, wl.id);
    expect(stateBefore5th.queueCount).toBe(4);

    // Player 5 joins: addToQueue adds them as "waiting"
    const player5 = db.createUser({ first_name: "Player5", last_name: "Test" });
    db.addPlayerToQueue(wl.id, player5.id);

    // === ABLY EVENT: "updated" fires NOW ===
    // Client refetches — sees 5 in queue, no teams
    const stateAtUpdatedEvent = getVisibleState(db, wl.id);
    expect(stateAtUpdatedEvent.queueCount).toBe(5);
    expect(stateAtUpdatedEvent.stagedTeamCount).toBe(0);
    expect(stateAtUpdatedEvent.totalVisible).toBe(5);

    // === checkAndAdvance runs, forms team ===
    const team = formTeam(db, wl.id, "White")!;

    // === ABLY EVENT: "team:formed" fires ===
    // Client refetches — sees 0 in queue, 1 staged team
    const stateAtTeamFormedEvent = getVisibleState(db, wl.id);
    expect(stateAtTeamFormedEvent.queueCount).toBe(0);
    expect(stateAtTeamFormedEvent.stagedTeamCount).toBe(1);
    expect(stateAtTeamFormedEvent.totalVisible).toBe(5);

    // THE FLASH: between "updated" and "team:formed", the UI transitions from
    // "5 players in queue list" → "0 players in queue list + game card"
    // This is TWO renders in quick succession that look like a flash.
    //
    // The fix: the "updated" event should NOT fire until after checkAndAdvance
    // completes, so the client only sees the final state.
    //
    // Verify the invariant: at both snapshots, all 5 players are accounted for
    assertAllPlayersVisible(db, wl.id, "after team formed");
  });

  it("after game completion and winner advance, all players remain visible", () => {
    const wl = db.createWaitlist({ max_wins: 2 });
    seedPlayers(db, wl.id, 15);

    // Form 2 teams and start game
    const team1 = formTeam(db, wl.id, "White")!;
    const team2 = formTeam(db, wl.id, "Blue")!;
    team1.status = "playing";
    team2.status = "playing";
    const game = db.createGame(wl.id, team1.id, team2.id);

    assertAllPlayersVisible(db, wl.id, "during game");

    // Game completes — White wins
    game.status = "completed";
    game.winner_id = team1.id;

    // Loser's players → completed
    const loserPlayerIds = db.getTeamPlayerIds(team2.id);
    for (const uid of loserPlayerIds) {
      const wp = db.tables.waitlist_players.find(
        (w) =>
          w.waitlist_id === wl.id &&
          w.user_id === uid &&
          w.status === "playing",
      );
      if (wp) wp.status = "completed";
    }
    team2.status = "completed";

    // Winner stays on as staged
    team1.status = "staged";

    // EVENT: "game:completed" fires — client refetches
    const stateAfterComplete = getVisibleState(db, wl.id);
    // 5 in queue + 5 on winning team = 10 visible (5 losers are completed, gone)
    expect(stateAfterComplete.queueCount).toBe(5);
    expect(stateAfterComplete.stagedTeamCount).toBe(1);
    expect(stateAfterComplete.totalVisible).toBe(10);

    // Form challenger team from remaining queue
    const team3 = formTeam(db, wl.id, "Blue")!;

    // EVENT: "team:formed" fires
    const stateAfterChallenger = getVisibleState(db, wl.id);
    expect(stateAfterChallenger.queueCount).toBe(0);
    expect(stateAfterChallenger.stagedTeamCount).toBe(2);
    expect(stateAfterChallenger.totalVisible).toBe(10);

    // Start game 2
    team1.status = "playing";
    team3.status = "playing";
    db.createGame(wl.id, team1.id, team3.id);

    // EVENT: "game:started" fires
    const stateAfterGame2 = assertAllPlayersVisible(
      db,
      wl.id,
      "game 2 started",
    );
    expect(stateAfterGame2.activeGame).not.toBeNull();
    expect(stateAfterGame2.totalVisible).toBe(10);
  });

  it("rapid sequential joins never cause total visible count to drop", () => {
    const wl = db.createWaitlist();
    let maxVisible = 0;

    // Simulate 12 players joining rapidly
    // After each join, simulate the full joinAndAdvance flow:
    // 1. addToQueue
    // 2. "updated" event → snapshot
    // 3. checkAndAdvance (may form team, start game)
    // 4. additional events → snapshots

    for (let i = 0; i < 12; i++) {
      const user = db.createUser({
        first_name: `Player${i + 1}`,
        last_name: "Test",
      });
      db.addPlayerToQueue(wl.id, user.id);

      // Snapshot at "updated" event
      const stateAfterJoin = getVisibleState(db, wl.id);

      // Total visible should never decrease (players join, they don't vanish)
      expect(
        stateAfterJoin.totalVisible,
        `After player ${i + 1} joined, total visible (${stateAfterJoin.totalVisible}) dropped below previous max (${maxVisible})`,
      ).toBeGreaterThanOrEqual(maxVisible);
      maxVisible = stateAfterJoin.totalVisible;

      // Simulate checkAndAdvance: form team if 5+ waiting
      const waiting = db.tables.waitlist_players.filter(
        (wp) => wp.waitlist_id === wl.id && wp.status === "waiting",
      );
      if (waiting.length >= 5) {
        const usedColors = db.getUsedColors(wl.id);
        const color = !usedColors.has("White") ? "White" : "Blue";
        const team = formTeam(db, wl.id, color)!;

        const stateAfterTeam = getVisibleState(db, wl.id);
        expect(
          stateAfterTeam.totalVisible,
          `After team formed (player ${i + 1}), total visible (${stateAfterTeam.totalVisible}) dropped below previous max (${maxVisible})`,
        ).toBeGreaterThanOrEqual(maxVisible);

        // Check if 2 staged teams → start game
        const staged = db.getStagedTeams(wl.id);
        if (staged.length >= 2) {
          staged[0].status = "playing";
          staged[1].status = "playing";
          db.createGame(wl.id, staged[0].id, staged[1].id);

          const stateAfterGame = getVisibleState(db, wl.id);
          expect(
            stateAfterGame.totalVisible,
            `After game started (player ${i + 1}), total visible (${stateAfterGame.totalVisible}) dropped below previous max (${maxVisible})`,
          ).toBeGreaterThanOrEqual(maxVisible);
        }
      }
    }

    // After 12 players: 10 should be in a game, 2 in queue
    const finalState = getVisibleState(db, wl.id);
    expect(finalState.totalVisible).toBe(12);
    expect(finalState.queueCount).toBe(2);
    expect(finalState.activeGame).not.toBeNull();
  });
});
