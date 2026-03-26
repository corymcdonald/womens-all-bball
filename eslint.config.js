const expo = require("eslint-config-expo/flat");

module.exports = [
  ...expo,
  {
    ignores: ["node_modules/**", ".expo/**", "scripts/**"],
  },
  {
    rules: {
      complexity: ["warn", 10],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["warn", { allow: ["error"] }],
    },
  },
];
