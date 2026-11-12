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
 * - RECIPE_REAL_STORE_ABI=arm   → the two real-world ARM ABIs (v7a+arm64),
 *                                 dropping the x86 emulator slices; used by
 *                                 the store-apk profile to halve APK size.
 * Precedence when several are set: UNIVERSAL wins (runs on every device —
 * the safe resolution), then ARM64_ONLY, then STORE_ABI=arm.
 */
module.exports = function arm64OnlyPlugin(config) {
  return withGradleProperties(config, (cfg) => {
    const forceUniversal = process.env.RECIPE_REAL_UNIVERSAL_ABI === "1";
    const forceArm64Only = process.env.RECIPE_REAL_ARM64_ONLY === "1";
    const forceArm = process.env.RECIPE_REAL_STORE_ABI === "arm";
    const profile = process.env.EAS_BUILD_PROFILE ?? "";
    const stripToArm64 = !forceUniversal && (forceArm64Only || (!forceArm && profile.startsWith("production")));

    const rest = cfg.modResults.filter((item) => item.key !== "reactNativeArchitectures");

    if (stripToArm64) {
      rest.push({ type: "property", key: "reactNativeArchitectures", value: "arm64-v8a" });
    } else if (forceArm) {
      // Store target: both real-world ARM ABIs — 32-bit phones still matter
      // in the MENA install base, but the x86 emulator slices are dead
      // weight in a universal APK (roughly a third of the file size).
      rest.push({ type: "property", key: "reactNativeArchitectures", value: "armeabi-v7a,arm64-v8a" });
    } else if (forceUniversal) {
      rest.push({ type: "property", key: "reactNativeArchitectures", value: "armeabi-v7a,arm64-v8a,x86,x86_64" });
    } else {
      return cfg; // preview/local builds stay universal by default
    }
    cfg.modResults = rest;
    return cfg;
  });
};
