import storybook from "eslint-plugin-storybook";
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

const i18nStaticTAllowedFiles = ["frontend/src/i18n/**/*.{ts,tsx}"];

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
    "**/storybook-static/**",
    "**/coverage/**",
    "**/playwright-report/**",
    "frontend/public/mockServiceWorker.js",
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
  ...scopeToFrontend(storybook.configs["flat/recommended"]),
  {
    files: nodeFiles,
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/no-explicit-any": "error"
    }
  },
  {
    files: frontendFiles,
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/refs": "error",
      "react-hooks/purity": "error",
      "react-hooks/exhaustive-deps": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/i18n",
              importNames: ["t"],
              message: "Use useI18n() in client components so translations follow the active locale."
            }
          ]
        }
      ]
    }
  },
  {
    files: i18nStaticTAllowedFiles,
    rules: {
      "no-restricted-imports": "off"
    }
  }
);
