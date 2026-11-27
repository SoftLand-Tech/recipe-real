const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Configure Android release signing from environment variables when present.
 *
 * When ANDROID_KEYSTORE_PATH is set (e.g. in GitHub Actions CI), Gradle signs
 * the release APK with that keystore instead of the default debug keystore.
 * When unset (local dev or EAS Build, which manages credentials externally),
 * the generated build.gradle keeps signingConfigs.debug untouched.
 */
module.exports = function releaseSigningPlugin(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    if (!contents.includes("signingConfigs.release")) {
      const signingBlockAnchor = /(\bsigningConfigs\s*\{\s*\n\s*debug\s*\{[\s\S]*?\n\s*\})/;
      if (!signingBlockAnchor.test(contents)) {
        throw new Error(
          "release-signing plugin: could not locate signingConfigs.debug block in android/app/build.gradle",
        );
      }
      contents = contents.replace(
        signingBlockAnchor,
        `$1
        release {
            if (System.getenv("ANDROID_KEYSTORE_PATH")) {
                storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }`,
      );

      const releaseBuildTypeAnchor =
        /(\bbuildTypes\s*\{[\s\S]*?\brelease\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
      if (!releaseBuildTypeAnchor.test(contents)) {
        throw new Error(
          "release-signing plugin: could not locate buildTypes.release signingConfig in android/app/build.gradle",
        );
      }
      contents = contents.replace(
        releaseBuildTypeAnchor,
        `$1signingConfig System.getenv("ANDROID_KEYSTORE_PATH") ? signingConfigs.release : signingConfigs.debug`,
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
};
