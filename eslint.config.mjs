export default [
  {
    ignores: [
      ".next/",
      "out/",
      "build/",
      "next-env.d.ts",
      "src/generated/",
      "**/*.ts",
      "**/*.tsx",
      "**/*.d.ts",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        global: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
      "prefer-const": "warn",
      "no-var": "error",
    },
  },
];