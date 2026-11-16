import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default defineConfig(
  // .worktrees: parallele Arbeitsstände (AGENTS.md, Lokale Ordnerstruktur) gehören nicht in diesen Lauf.
  globalIgnores(["dist", ".worktrees"]),
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      "no-console": ["error", { allow: ["error"] }],
      "@typescript-eslint/no-explicit-any": "warn",
      // Phase 2 additions
      "react-hooks/exhaustive-deps": "error",
      "@typescript-eslint/consistent-type-imports": ["error", {
        prefer: "type-imports",
        fixStyle: "inline-type-imports",
      }],
      "prefer-const": "error",
      "no-var": "error",
      // Neu mit ESLint 10 (eslint:recommended) und eslint-plugin-react-hooks 7 (Regeln des React
      // Compilers). Wo der Bestand schon Fundstellen hat, vorerst Warnung: Ihre Behebung ändert
      // Verhalten (State in Effekten, Refs und Date.now() im Render, Fehlerobjekte) und gehört in
      // eigene Commits. Die übrigen neuen Regeln bleiben Fehler (Werkzeug-Update 16.11.2026).
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "no-useless-assignment": "warn",
      "preserve-caught-error": "warn",
    },
  },
  // Override rules for Supabase Edge Functions (allow console logging)
  {
    files: ["supabase/functions/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off",
    },
  },
  // Override rules for test files
  {
    files: ["**/*.test.{ts,tsx}", "**/test/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-require-imports": "off",
      // Tests halten Hook-Ergebnisse in Variablen außerhalb der Komponente fest; im App-Code
      // bleibt die Regel ein Fehler.
      "react-hooks/globals": "warn",
    },
  },
);
