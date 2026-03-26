import { useCallback, useEffect, useState } from "react";
import type { GameResult } from "@/lib/types";
import { listGames } from "@/lib/api";
import { formatWaitlistDate } from "@/lib/format-date";

export type GameWithStreak = GameResult & {
  winnerStreak: number;
};

export type GameSection = {
  title: string;
  data: GameWithStreak[];
};

/**
 * Compute win streaks for each game within a waitlist group.
 * Games arrive newest-first; walk oldest-first to accumulate streaks.
 */
function attachStreaks(games: GameResult[]): GameWithStreak[] {
  const reversed = [...games].reverse(); // oldest first
  const result: GameWithStreak[] = [];
  let currentStreakTeamId: string | null = null;
  let currentStreak = 0;

  for (const game of reversed) {
    if (game.winner_id === currentStreakTeamId) {
      currentStreak++;
    } else {
      currentStreakTeamId = game.winner_id;
      currentStreak = 1;
    }
    result.push({ ...game, winnerStreak: currentStreak });
  }

  return result.reverse(); // back to newest-first
}

function groupByWaitlist(games: GameResult[]): GameSection[] {
  const map = new Map<string, { title: string; data: GameResult[] }>();

  for (const game of games) {
    const key = game.waitlist.id;
    if (!map.has(key)) {
      map.set(key, {
        title: formatWaitlistDate(game.waitlist.created_at),
        data: [],
      });
    }
    map.get(key)!.data.push(game);
  }

  return Array.from(map.values()).map((section) => ({
    ...section,
    data: attachStreaks(section.data),
  }));
}

export function useGames() {
  const [sections, setSections] = useState<GameSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    try {
      const res = await listGames();
      setSections(groupByWaitlist(res.data));
      setNextCursor(res.cursor);
    } catch {
      // Keep existing data on error
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await listGames();
      setSections(groupByWaitlist(res.data));
      setNextCursor(res.cursor);
    } catch {
      // Keep existing data on error
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  return { sections, loading, refreshing, onRefresh, nextCursor };
}
