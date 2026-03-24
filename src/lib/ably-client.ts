import Ably from "ably";

// Client-side: subscribe to real-time updates
export function getAblyClient() {
  return new Ably.Realtime(process.env.EXPO_PUBLIC_ABLY_SUBSCRIBE_KEY!);
}
