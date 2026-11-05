const { withGradleProperties } = require("expo/config-plugins");

/**
 * Production APK size: strip the native libraries to arm64-v8a ONLY.
 *
 * React Native's gradle build reads `reactNativeArchitectures` (default
 * "armeabi-v7a,arm64-v8a,x86,x86_64") and filters every .so it packages by
 * it. Dropping to the single ABI every phone since ~2016 uses turns the
 * ~120MB universal artifact into a ~30-35MB APK — the difference the
 * Play Store normally gets for free via AAB splitting, which we can't use
 * (direct APK distribution).
 *
 * Default scoping: EAS production profiles only (EAS_BUILD_PROFILE starts
 * with "production") so preview builds and anything running locally stay
 * universal.
 *
 * Explicit env overrides (documented in docs/store-release.md; each beats
 * the profile heuristic — handy for local `npx expo prebuild`/`gradlew`
 * runs where EAS_BUILD_PROFILE is unset):
 * - RECIPE_REAL_UNIVERSAL_ABI=1 → universal regardless of profile.
 * - RECIPE_REAL_ARM64_ONLY=1    → arm64-v8a only regardless of profile.
 * If both are set, universal wins (it runs on every device, so it is the
 * safe resolution for contradictory config).
 */
module.exports = function arm64OnlyPlugin(config) {
  return withGradleProperties(config, (cfg) => {
    const forceUniversal = process.env.RECIPE_REAL_UNIVERSAL_ABI === "1";
    const forceArm64Only = process.env.RECIPE_REAL_ARM64_ONLY === "1";
    let arm64Only;
    if (forceUniversal) {
      arm64Only = false;
    } else if (forceArm64Only) {
      arm64Only = true;
    } else {
      const profile = process.env.EAS_BUILD_PROFILE ?? "";
      arm64Only = profile.startsWith("production");
    }
    if (!arm64Only) {
      return cfg;
    }
    const rest = cfg.modResults.filter((item) => item.key !== "reactNativeArchitectures");
    rest.push({ type: "property", key: "reactNativeArchitectures", value: "arm64-v8a" });
    cfg.modResults = rest;
    return cfg;
  });
};
