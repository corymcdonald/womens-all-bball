import { PostHog } from "posthog-node";

const apiKey = process.env.POSTHOG_PROJECT_TOKEN;
const host = process.env.POSTHOG_HOST;
const isConfigured = !!apiKey && apiKey !== "phc_your_project_token_here";

// Singleton client for server-side event tracking in API routes.
// flushAt: 1 ensures events are sent immediately without batching.
export const posthogServer = isConfigured
  ? new PostHog(apiKey!, { host, flushAt: 1, flushInterval: 0 })
  : null;
