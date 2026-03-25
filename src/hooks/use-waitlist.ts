import { useCallback, useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
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
    } finally {
      setLoading(false);
    }
  }, []);

  // Wrap a mutating action: set mutating flag, run action + refresh, clear flag
  const withMutation = useCallback(
    async (fn: () => Promise<void>) => {
      setMutating(true);
      setError("");
      try {
        await fn();
        await fetchLatestWaitlist();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setMutating(false);
      }
    },
    [fetchLatestWaitlist],
  );

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

  const joinWithToken = useCallback(
    (token: string) =>
      withMutation(async () => {
        if (!waitlistId) return;
        await api.joinWaitlistWithToken(waitlistId, token);
        await addAuthorizedWaitlist(waitlistId);
        setIsAuthorized(true);
      }),
    [waitlistId, withMutation],
  );

  const quickJoin = useCallback(
    () =>
      withMutation(async () => {
        if (!waitlistId) return;
        await api.rejoinWaitlist(waitlistId);
      }),
    [waitlistId, withMutation],
  );

  const leave = useCallback(
    () =>
      withMutation(async () => {
        if (!waitlistId) return;
        await api.leaveWaitlist(waitlistId);
      }),
    [waitlistId, withMutation],
  );

  const markAbsent = useCallback(
    (waitlistPlayerId: string) =>
      withMutation(async () => {
        if (!waitlistId) return;
        await api.markAbsent(waitlistId, waitlistPlayerId);
      }),
    [waitlistId, withMutation],
  );

  const markPresent = useCallback(
    (waitlistPlayerId: string) =>
      withMutation(async () => {
        if (!waitlistId) return;
        await api.markPresent(waitlistId, waitlistPlayerId);
      }),
    [waitlistId, withMutation],
  );

  const markLeft = useCallback(
    (waitlistPlayerId: string) =>
      withMutation(async () => {
        if (!waitlistId) return;
        await api.markLeft(waitlistId, waitlistPlayerId);
      }),
    [waitlistId, withMutation],
  );

  const reorder = useCallback(
    (playerIds: string[]) =>
      withMutation(async () => {
        if (!waitlistId) return;
        await api.reorderQueue(waitlistId, playerIds);
      }),
    [waitlistId, withMutation],
  );

  const declareWinner = useCallback(
    (gameId: string, winnerId: string) =>
      withMutation(async () => {
        await api.completeGame(gameId, winnerId);
      }),
    [withMutation],
  );

  const updateTeamColor = useCallback(
    (teamId: string, color: string) =>
      withMutation(async () => {
        await api.updateTeam(teamId, { color });
      }),
    [withMutation],
  );

  const isInQueue = !!data?.queue.find((p) => p.user_id === user?.id);
  const isPlaying = !!data?.playing.some((p) => p.user_id === user?.id);

  return {
    waitlistId,
    data,
    loading,
    mutating,
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
    markAbsent,
    markPresent,
    markLeft,
    reorder,
    declareWinner,
    updateTeamColor,
  };
}
