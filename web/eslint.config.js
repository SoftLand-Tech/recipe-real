// Flat ESLint config for the web workspace — typescript-eslint's recommended
// set, mirroring the spirit of mobile's eslint.config.js (expo preset) minus
// every React Native rule. NOTE: eslint-plugin-react-hooks is deliberately
// NOT included (the scaffold dependency set is fixed); hook correctness leans
// on TypeScript + review until the dep budget opens up.
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "../backend/public/app/**"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Foundational code loves a named status union; slices should too, but
      // string literals in dictionaries/config are a normal pattern here, so
      // keep the rule off rather than littering switches that add nothing.
      "@typescript-eslint/switch-exhaustiveness-check": "off",
    },
  },
);
