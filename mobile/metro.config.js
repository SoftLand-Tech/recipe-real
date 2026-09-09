const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// expo-sqlite on web loads wa-sqlite.wasm as a Metro asset
config.resolver.assetExts.push("wasm");

// wa-sqlite's persistent VFS needs SharedArrayBuffer, which requires
// cross-origin isolation (COOP/COEP headers) in the browser
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  return middleware(req, res, next);
};

module.exports = withNativeWind(config, { input: "./global.css" });
