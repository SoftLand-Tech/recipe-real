/**
 * Dynamic Expo config (replaces the static app.json).
 *
 * The backend base URL is environment-aware so one checkout serves both
 * flows without hand-editing config before every build:
 * - local dev (`npx expo start`): same production URL (no LAN backend).
 * - EAS preview/production builds: eas.json profile `env` injects
 *   RECIPEREAL_API_BASE_URL=https://recipe-real.softland.tech.
 * - `eas update`: resolved from the shell env or the EAS "production"
 *   environment — always publish updates with the production URL set,
 *   otherwise the update bundle bakes in the dev fallback.
 */
const API_BASE_URL =
  process.env.RECIPEREAL_API_BASE_URL || "https://recipe-real.softland.tech";

export default {
  name: "RecipeReal",
  slug: "vibe-labs",
  version: "1.1.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "recipereal",
  userInterfaceStyle: "automatic",
  updates: {
    url: "https://u.expo.dev/5c0acc82-1f29-48b1-a1b4-64aeecb11836",
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: {
    policy: "fingerprint",
  },
  ios: {
    icon: "./assets/images/icon.png",
    bundleIdentifier: "com.recipereal.app",
  },
  android: {
    package: "com.recipereal.app",
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "recipe-real.softland.tech",
            pathPrefix: "/p",
          },
          {
            scheme: "https",
            host: "recipe-real.softland.tech",
            pathPrefix: "/r",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    adaptiveIcon: {
      backgroundColor: "#FBF8F3",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    allowBackup: false,
    permissions: ["FOREGROUND_SERVICE", "SCHEDULE_EXACT_ALARM"],
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FAF8F5",
        image: "./assets/images/splash-icon.png",
        imageWidth: 132,
        dark: {
          backgroundColor: "#171310",
        },
      },
    ],
    "expo-secure-store",
    "expo-localization",
    "expo-image",
    "./plugins/arm64-only",
    [
      "expo-build-properties",
      {
        android: {
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          extraProguardRules:
            "-keep class expo.modules.updates.** { *; }\n-keep class expo.modules.updates-interface.** { *; }",
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    reciperealApiBaseUrl: API_BASE_URL,
    googleWebClientId:
      "412318680966-oo5cbharsvo1jo4fvi6824taqq6n6du5.apps.googleusercontent.com",
    router: {},
    eas: {
      projectId: "5c0acc82-1f29-48b1-a1b4-64aeecb11836",
    },
  },
  owner: "vibelabs0s-team",
};
