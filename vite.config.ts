import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { componentTagger } from "lovable-tagger";

// Die klassischen Skripte aus public/js/ (index.html) haben keinen Hash im
// Dateinamen und werden einen Tag gecacht: ?v=<Inhalts-Hash> sorgt dafür, dass
// Browser nach einem Deploy die neue Fassung laden.
const versionPublicScripts = (): Plugin => ({
  name: "kw-version-public-scripts",
  apply: "build",
  transformIndexHtml: {
    order: "post",
    handler: (html) =>
      html.replace(/<script src="\/js\/([\w.-]+\.js)"><\/script>/g, (_tag, file: string) => {
        const hash = createHash("sha256")
          .update(readFileSync(path.resolve(__dirname, "public/js", file)))
          .digest("hex")
          .slice(0, 10);
        return `<script src="/js/${file}?v=${hash}"></script>`;
      }),
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), versionPublicScripts(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Vite's default modulePreload walks the entry's transitive async-import
    // graph and emits <link rel="modulepreload"> for every reachable chunk.
    // For our SPA that means heavy admin-only bundles (recharts, the rich
    // text editor) get fetched on every public page load — wasted bytes for
    // 99 % of visitors. We curate the preload list so the entry HTML only
    // hints at chunks the user will likely need on first interaction.
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter((dep) => {
          // Heavy chunks that are only needed on a tiny minority of routes
          // are loaded on demand by the lazy chunk that uses them, instead
          // of being preloaded on every public page hit. Keep this list
          // conservative — anything used by Login/Register/Wizard/Hero
          // (vendor-forms, vendor-icons, vendor-query) MUST stay preloaded
          // to avoid a regression on the most common landing pages.
          if (dep.includes("vendor-recharts")) return false; // only AdminAnalytics
          if (dep.includes("vendor-editor")) return false; // only AdminBlog
          return true;
        }),
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core – rarely changes, excellent cache hit rate
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router-dom/") ||
            id.includes("node_modules/react-router/") ||
            id.includes("node_modules/@remix-run/")
          ) {
            return "vendor-react";
          }

          // Supabase client – separate chunk for backend SDK
          if (id.includes("node_modules/@supabase/")) {
            return "vendor-supabase";
          }

          // Data fetching and state management
          if (id.includes("node_modules/@tanstack/")) {
            return "vendor-query";
          }

          // Charts library – only needed on pages with charts
          if (
            id.includes("node_modules/recharts/") ||
            id.includes("node_modules/d3-") ||
            id.includes("node_modules/victory-")
          ) {
            return "vendor-recharts";
          }

          // Date utilities
          if (id.includes("node_modules/date-fns/")) {
            return "vendor-date";
          }

          // Icon library
          if (id.includes("node_modules/lucide-react/")) {
            return "vendor-icons";
          }

          // Rich text editor (tiptap + prosemirror)
          if (
            id.includes("node_modules/@tiptap/") ||
            id.includes("node_modules/prosemirror-") ||
            id.includes("node_modules/@prosemirror/")
          ) {
            return "vendor-editor";
          }

          // Form handling
          if (
            id.includes("node_modules/react-hook-form/") ||
            id.includes("node_modules/@hookform/") ||
            id.includes("node_modules/zod/")
          ) {
            return "vendor-forms";
          }

          // UI primitives (Radix + related)
          if (
            id.includes("node_modules/@radix-ui/") ||
            id.includes("node_modules/@floating-ui/")
          ) {
            return "vendor-ui";
          }
        },
      },
    },
  },
}));
