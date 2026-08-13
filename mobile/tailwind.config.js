/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: This file is picked up automatically by `nativewind/metro`.
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};
