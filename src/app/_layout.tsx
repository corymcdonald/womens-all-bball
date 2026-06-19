import { log } from "@/lib/boot-log"; // must be first: installs error handler
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { usePathname, useGlobalSearchParams } from "expo-router";
import { ClerkProvider, ClerkLoaded, ClerkLoading, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { PostHogProvider } from "posthog-react-native";
import React, { useEffect } from "react";
import { ActivityIndicator, ScrollView, Text, View, useColorScheme } from "react-native";
import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AppTabs from "@/components/app-tabs";
import { setClerkTokenGetter } from "@/lib/api";
import { posthog } from "@/lib/posthog";
import { UserProvider } from "@/lib/user-context";
import { AuthGateProvider } from "@/lib/auth-gate-context";

const publishableKeyRaw = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const publishableKey = publishableKeyRaw!;

log(
  "_layout.tsx: all imports resolved",
  "| clerkKey present:",
  !!publishableKeyRaw,
  "| clerkKey prefix:",
  publishableKeyRaw?.slice(0, 8),
  "| clerkKey length:",
  publishableKeyRaw?.length,
  "| posthog instance:",
  !!posthog,
);

// Expo Router renders this instead of a blank/black screen when any descendant
// throws during render — including in release builds where there's no redbox.
export function ErrorBoundary({
  error,
  retry,
}: {
  error: Error;
  retry: () => Promise<void>;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: "#1a1a1a", padding: 24 }}>
      <ScrollView contentContainerStyle={{ paddingTop: 80 }}>
        <Text style={{ color: "#ff6b6b", fontSize: 20, fontWeight: "700" }}>
          App failed to render
        </Text>
        <Text style={{ color: "#fff", marginTop: 16, fontFamily: "Courier" }}>
          {error?.name}: {error?.message}
        </Text>
        <Text style={{ color: "#aaa", marginTop: 16, fontFamily: "Courier" }}>
          {error?.stack}
        </Text>
        <Text
          onPress={() => retry()}
          style={{ color: "#208AEF", marginTop: 24, fontSize: 16 }}
        >
          Tap to retry
        </Text>
      </ScrollView>
    </View>
  );
}

// Tiny mount probe so we can see in the logs which Clerk branch actually
// rendered (loading vs. loaded) and when.
function BootProbe({ name }: { name: string }) {
  useEffect(() => {
    log(`mounted: ${name}`);
  }, [name]);
  return null;
}

// Reports Clerk's loading state on every change and once per second, so we can
// see whether it is stuck in "not loaded" and for how long. Must live inside
// <ClerkProvider> but outside <ClerkLoaded>/<ClerkLoading>.
function ClerkStateProbe() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    log("Clerk state change | isLoaded:", isLoaded, "| isSignedIn:", isSignedIn);
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    let ticks = 0;
    const id = setInterval(() => {
      ticks += 1;
      log(`Clerk still initializing… ${ticks}s | isLoaded: ${isLoaded}`);
    }, 1000);
    return () => clearInterval(id);
  }, [isLoaded]);

  return null;
}

function ClerkTokenBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setClerkTokenGetter(() => getToken());
  }, [getToken]);

  return null;
}

function ScreenTracker() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();

  useEffect(() => {
    posthog.screen(pathname, params as Record<string, string>);
  }, [pathname, params]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  log("RootLayout: render", "| colorScheme:", colorScheme);
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkStateProbe />
      <ClerkLoading>
        <BootProbe name="ClerkLoading (Clerk still initializing)" />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#208AEF",
          }}
        >
          <ActivityIndicator color="#fff" />
          <Text style={{ color: "#fff", marginTop: 12 }}>Loading…</Text>
        </View>
      </ClerkLoading>
      <ClerkLoaded>
        <BootProbe name="ClerkLoaded (Clerk ready, rendering app)" />
        <ClerkTokenBridge />
        <PostHogProvider client={posthog}>
          <UserProvider>
            <AuthGateProvider>
              <ThemeProvider
                value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
              >
                <ScreenTracker />
                <AnimatedSplashOverlay />
                <AppTabs />
              </ThemeProvider>
            </AuthGateProvider>
          </UserProvider>
        </PostHogProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
