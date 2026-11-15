// Flat ESLint config for the web workspace — typescript-eslint's recommended
// set, mirroring the spirit of mobile's eslint.config.js (expo preset) minus
// every React Native rule, plus eslint-plugin-react-hooks (added after the
// foundation review caught a useSyncExternalStore snapshot bug — exactly the
// class of mistake this plugin flags before review has to).
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "../backend/public/app/**"],
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Foundational code loves a named status union; slices should too, but
      // string literals in dictionaries/config are a normal pattern here, so
      // keep the rule off rather than littering switches that add nothing.
      "@typescript-eslint/switch-exhaustiveness-check": "off",
    },
  },
);
