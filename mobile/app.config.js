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
          {
            scheme: "https",
            host: "recipe-real.softland.tech",
            pathPrefix: "/u",
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
    // FOREGROUND_SERVICE is deliberately NOT requested: no foreground
    // service runs (Android 14 shortService cap made it useless), and
    // blockedPermissions also strips the copy notifee merges from its AAR.
    permissions: ["SCHEDULE_EXACT_ALARM"],
    blockedPermissions: [
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
      "FOREGROUND_SERVICE",
    ],
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
    [
      "expo-image-picker",
      {
        photosPermission: "Select photos for your avatar, posts and recipes.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    "./plugins/arm64-only",
    [
      "expo-build-properties",
      {
        android: {
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          // Compress .so files inside the APK instead of storing them
          // uncompressed. Much smaller download (the direct-APK equivalent
          // of what AAB splitting does on Play); first launch extracts
          // them — a little disk + startup time, the right trade for a
          // sideloaded app.
          useLegacyPackaging: true,
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
    // "recipereal" Cloud project (2026-11) — published consent screen.
    googleWebClientId:
      "546591490861-c6gqi2a7q2ueqfrl4lu0khs3qbfjercq.apps.googleusercontent.com",
    router: {},
    eas: {
      projectId: "5c0acc82-1f29-48b1-a1b4-64aeecb11836",
    },
  },
  owner: "vibelabs0s-team",
};
