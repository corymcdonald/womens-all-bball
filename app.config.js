export default {
  expo: {
    name: "womens-all-b-ball",
    slug: "womens-all-b-ball",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "womensallbball",
    userInterfaceStyle: "automatic",
    ios: {
      bundleIdentifier: "com.womensallbball.app",
      icon: "./assets/expo.icon",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.womensallbball.app",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: "server",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#208AEF",
          android: {
            image: "./assets/images/splash-icon.png",
            imageWidth: 76,
          },
        },
        "expo-font",
        "expo-image",
        "expo-localization",
        "expo-secure-store",
        "expo-web-browser",
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      posthogProjectToken: process.env.POSTHOG_PROJECT_TOKEN,
      posthogHost: process.env.POSTHOG_HOST,
      eas: {
        projectId: "312b926b-d8bf-4fdf-b287-0f10c9d5c27b",
      },
    },
    owner: "corymc",
  },
};
