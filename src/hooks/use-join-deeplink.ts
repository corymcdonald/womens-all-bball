import { useEffect } from "react";
import * as Linking from "expo-linking";
import * as api from "@/lib/api";

export function useJoinDeepLink(options: {
  onJoined: () => void;
  onError: (message: string) => void;
  requireAuth: (cb: () => void) => void;
}) {
  useEffect(() => {
    function handleUrl(event: { url: string }) {
      const parsed = Linking.parse(event.url);
      if (parsed.path !== "join") return;

      const waitlistId = parsed.queryParams?.waitlist;
      const token = parsed.queryParams?.token;

      if (typeof waitlistId !== "string" || typeof token !== "string") return;

      options.requireAuth(() => {
        api
          .joinWaitlistWithToken(waitlistId, token)
          .then(() => options.onJoined())
          .catch((e) =>
            options.onError(e instanceof Error ? e.message : "Failed to join"),
          );
      });
    }

    // Handle deep link if the app was opened by one
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    // Handle deep links while the app is already open
    const subscription = Linking.addEventListener("url", handleUrl);
    return () => subscription.remove();
  }, [options.onJoined, options.onError, options.requireAuth]);
}
