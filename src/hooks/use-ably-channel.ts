import { useEffect, useRef } from "react";
import type Ably from "ably";
import { getAblyClient } from "@/lib/ably-client";

export function useAblyChannel(
  channelName: string | null,
  onMessage: (message: Ably.Message) => void,
) {
  const clientRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);

  useEffect(() => {
    if (!channelName) return;

    // Only create client if we have a key
    const key = process.env.EXPO_PUBLIC_ABLY_SUBSCRIBE_KEY;
    if (!key) return;

    const client = getAblyClient();
    clientRef.current = client;

    const channel = client.channels.get(channelName);
    channelRef.current = channel;

    channel.subscribe(onMessage);

    return () => {
      channel.unsubscribe(onMessage);
      channel.detach();
      client.close();
      clientRef.current = null;
      channelRef.current = null;
    };
  }, [channelName]);
}
