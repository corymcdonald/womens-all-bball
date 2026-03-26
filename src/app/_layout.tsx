import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { usePathname, useGlobalSearchParams } from "expo-router";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { PostHogProvider } from "posthog-react-native";
import React, { useEffect } from "react";
import { useColorScheme } from "react-native";
import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AppTabs from "@/components/app-tabs";
import { setClerkTokenGetter } from "@/lib/api";
import { posthog } from "@/lib/posthog";
import { UserProvider } from "@/lib/user-context";
import { AuthGateProvider } from "@/lib/auth-gate-context";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

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
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
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
