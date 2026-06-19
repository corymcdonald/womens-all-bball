// Earliest boot instrumentation. Imported FIRST in _layout.tsx so it runs
// before any other app module initializes. All output is prefixed with a
// stable tag so you can filter it in Console.app / Xcode device logs:
//   filter:  [boot]
const TAG = "[boot]";

export function log(...args: unknown[]) {
  console.log(TAG, ...args);
}

log("boot-log module loaded — JS bundle is executing");

// Install a global handler for UNCAUGHT JS errors (async throws, errors thrown
// during module initialization, etc.). React's <ErrorBoundary> only catches
// errors thrown during render of components below it — these slip past it and
// otherwise produce a silent blank screen in release builds.
type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;
const g = globalThis as unknown as {
  ErrorUtils?: {
    getGlobalHandler?: () => GlobalErrorHandler;
    setGlobalHandler?: (handler: GlobalErrorHandler) => void;
  };
};

if (g.ErrorUtils?.setGlobalHandler) {
  const previous = g.ErrorUtils.getGlobalHandler?.();
  g.ErrorUtils.setGlobalHandler((error, isFatal) => {
    const e = error as Error | undefined;
    console.log(TAG, "UNCAUGHT", isFatal ? "(FATAL)" : "", e?.name, "-", e?.message);
    console.log(TAG, "STACK", e?.stack);
    previous?.(error, isFatal);
  });
  log("global error handler installed");
} else {
  log("ErrorUtils not available — cannot install global error handler");
}

// Wrap fetch so we can SEE the network requests Clerk makes during init
// (it fetches /v1/environment and /v1/client from the Frontend API). If init
// hangs, this reveals whether a request is pending, slow, or failing.
const originalFetch = globalThis.fetch;
if (typeof originalFetch === "function") {
  globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
    const input = args[0];
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request)?.url;
    const watched =
      typeof url === "string" && (url.includes("clerk") || url.includes("/v1/"));
    const started = Date.now();
    if (watched) log("fetch → REQUEST", url);
    try {
      const res = await originalFetch(...args);
      if (watched) {
        log("fetch ← RESPONSE", res.status, `${Date.now() - started}ms`, url);
        if (res.status >= 400) {
          // Clone so we don't consume the body the SDK still needs to read.
          const body = await res
            .clone()
            .text()
            .catch(() => "<unreadable>");
          log("fetch ← ERROR BODY", res.status, body.slice(0, 600));
        }
      }
      return res;
    } catch (err) {
      if (watched) {
        log(
          "fetch ✗ FAILED",
          (err as Error)?.message,
          `${Date.now() - started}ms`,
          url,
        );
      }
      throw err;
    }
  };
  log("fetch instrumentation installed");
}
