import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { usePathname, useGlobalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { useColorScheme } from "react-native";
import { PostHogProvider } from "posthog-react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AppTabs from "@/components/app-tabs";
import { posthog } from "@/lib/posthog";
import { UserProvider } from "@/lib/user-context";

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
    <PostHogProvider client={posthog}>
      <UserProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <ScreenTracker />
          <AnimatedSplashOverlay />
          <AppTabs />
        </ThemeProvider>
      </UserProvider>
    </PostHogProvider>
  );
}
