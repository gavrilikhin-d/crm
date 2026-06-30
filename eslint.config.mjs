import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import nextTs from "eslint-config-next/typescript";
import nextVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";
import tseslint from "typescript-eslint";

const nodeFiles = [
  "shared/src/**/*.ts",
  "backend/src/**/*.ts",
  "bot/src/**/*.ts",
  "reminder/src/**/*.ts",
  "scripts/**/*.ts"
];

const frontendFiles = ["frontend/**/*.{js,jsx,ts,tsx}"];

function scopeToFrontend(configs) {
  return configs.flatMap((config) => {
    if (!config || typeof config !== "object") {
      return [];
    }

    const files = config.files?.length
      ? config.files.map((pattern) => (typeof pattern === "string" ? `frontend/${pattern}` : pattern))
      : frontendFiles;

    return [
      {
        ...config,
        files,
        settings: {
          ...config.settings,
          next: {
            rootDir: "frontend/"
          }
        }
      }
    ];
  });
}

export default defineConfig(
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/dist/**",
    "**/coverage/**",
    "frontend/next-env.d.ts"
  ]),
  ...tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
      files: nodeFiles,
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        globals: globals.node
      }
    }
  ),
  ...scopeToFrontend(nextVitals),
  ...scopeToFrontend(nextTs),
  {
    files: nodeFiles,
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/no-explicit-any": "warn"
    }
  },
  {
    files: frontendFiles,
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/exhaustive-deps": "warn"
    }
  }
);
