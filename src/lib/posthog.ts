import Constants from "expo-constants";
import PostHog from "posthog-react-native";
import { log } from "./boot-log";

const apiKey = Constants.expoConfig?.extra?.posthogProjectToken as
  | string
  | undefined;
const host = Constants.expoConfig?.extra?.posthogHost as string | undefined;
const isPostHogConfigured =
  !!apiKey && apiKey !== "phc_your_project_token_here";

log(
  "posthog.ts: initializing",
  "| apiKey present:",
  !!apiKey,
  "| host:",
  host,
  "| configured:",
  isPostHogConfigured,
);

export const posthog = new PostHog(apiKey || "placeholder_key", {
  host,
  disabled: !isPostHogConfigured,
  captureAppLifecycleEvents: true,
  flushAt: 20,
  flushInterval: 10000,
});

log("posthog.ts: PostHog instance created");
