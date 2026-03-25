import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "@/lib/api";
import { useUser } from "@/lib/user-context";
import { useAblyChannel } from "@/hooks/use-ably-channel";
import {
  addAuthorizedWaitlist,
  getAuthorizedWaitlists,
} from "@/lib/user-store";

export type WaitlistData = Awaited<ReturnType<typeof api.getWaitlist>>;

export function useWaitlist() {
  const { user } = useUser();

  const [waitlistId, setWaitlistId] = useState<string | null>(null);
  const [data, setData] = useState<WaitlistData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState("");

  const fetchLatestWaitlist = useCallback(async () => {
    try {
      const waitlists = await api.listWaitlists();
      if (waitlists.length > 0) {
        const id = waitlists[0].id;
        setWaitlistId(id);
        const waitlistData = await api.getWaitlist(id);
        setData(waitlistData);

        const authorized = await getAuthorizedWaitlists();
        setIsAuthorized(authorized.includes(id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    fetchLatestWaitlist();
  }, [fetchLatestWaitlist]);

  // Subscribe to real-time updates via Ably
  const channelName = waitlistId ? `waitlist:${waitlistId}` : null;
  useAblyChannel(channelName, () => {
    fetchLatestWaitlist();
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLatestWaitlist();
    setRefreshing(false);
  }, [fetchLatestWaitlist]);

  async function joinWithToken(token: string) {
    if (!waitlistId) return;
    setError("");
    try {
      await api.joinWaitlistWithToken(waitlistId, token);
      await addAuthorizedWaitlist(waitlistId);
      setIsAuthorized(true);
      await fetchLatestWaitlist();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join");
    }
  }

  async function quickJoin() {
    if (!waitlistId) return;
    setError("");
    try {
      await api.rejoinWaitlist(waitlistId);
      await fetchLatestWaitlist();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join");
    }
  }

  async function leave() {
    if (!waitlistId) return;
    try {
      await api.leaveWaitlist(waitlistId);
      await fetchLatestWaitlist();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to leave");
    }
  }

  async function formTeam() {
    if (!waitlistId) return;
    try {
      await api.formTeam(waitlistId);
      await fetchLatestWaitlist();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Not enough players");
    }
  }

  async function markAbsent(waitlistPlayerId: string) {
    if (!waitlistId) return;
    try {
      await api.markAbsent(waitlistId, waitlistPlayerId);
      await fetchLatestWaitlist();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function markPresent(waitlistPlayerId: string) {
    if (!waitlistId) return;
    try {
      await api.markPresent(waitlistId, waitlistPlayerId);
      await fetchLatestWaitlist();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function markLeft(waitlistPlayerId: string) {
    if (!waitlistId) return;
    try {
      await api.markLeft(waitlistId, waitlistPlayerId);
      await fetchLatestWaitlist();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function reorder(playerIds: string[]) {
    if (!waitlistId) return;
    try {
      await api.reorderQueue(waitlistId, playerIds);
      await fetchLatestWaitlist();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reorder");
    }
  }

  async function startGame(team1Id: string, team2Id: string) {
    if (!waitlistId) return;
    try {
      await api.createGame(waitlistId, team1Id, team2Id);
      await fetchLatestWaitlist();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start game");
    }
  }

  async function endGame(
    gameId: string,
    winnerId: string,
  ): Promise<{
    streak_maxed: boolean;
    players_needed: number;
  } | null> {
    try {
      const result = await api.completeGame(gameId, winnerId);
      await fetchLatestWaitlist();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to end game");
      return null;
    }
  }

  async function nextGame(gameId: string, stayingTeamId?: string) {
    try {
      await api.nextGame(gameId, stayingTeamId);
      await fetchLatestWaitlist();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start next game");
    }
  }

  async function updateTeamColor(teamId: string, color: string) {
    try {
      await api.updateTeam(teamId, { color });
      await fetchLatestWaitlist();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update color");
    }
  }

  const isInQueue = !!data?.queue.find((p) => p.user_id === user?.id);
  const isPlaying = !!data?.playing.some((p) => p.user_id === user?.id);

  return {
    waitlistId,
    data,
    refreshing,
    isAuthorized,
    error,
    setError,
    isInQueue,
    isPlaying,
    onRefresh,
    fetchLatestWaitlist,
    joinWithToken,
    quickJoin,
    leave,
    formTeam,
    markAbsent,
    markPresent,
    markLeft,
    reorder,
    startGame,
    endGame,
    nextGame,
    updateTeamColor,
  };
}
