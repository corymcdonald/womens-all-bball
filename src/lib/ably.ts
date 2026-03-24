import Ably from "ably";

// Server-side: publish events when data changes
export function getAblyServer() {
  return new Ably.Rest(process.env.ABLY_API_KEY!);
}

export async function publishEvent(
  channel: string,
  event: string,
  data?: unknown,
) {
  const ably = getAblyServer();
  const ch = ably.channels.get(channel);
  await ch.publish(event, data);
}
