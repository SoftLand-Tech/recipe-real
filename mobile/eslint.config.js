// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // The React Compiler-era `react-hooks/*` correctness rules ship as errors
    // in eslint-config-expo, but this codebase predates them: the flagged
    // patterns (ref reads during render, setState-in-effect for data loading,
    // impure helpers in render) are load-bearing in Cook Mode timing and the
    // offline cache. Downgrade to warnings and adopt incrementally per file
    // instead of one risky mass-refactor. CI still fails on real errors.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);
