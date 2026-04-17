import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";
import { componentTagger } from "lovable-tagger";

// Resolve the current git SHA once per build so it can be injected into the
// bundle as VITE_APP_VERSION and logged with every error. This is what makes
// retroactive stack-decoding reliable: a production error_logs row carries the
// SHA, and `npm run decode-stack` can rebuild that exact commit locally to
// produce matching sourcemaps.
function resolveGitSha(): string {
  // Prefer the CI-provided commit hash (Netlify sets COMMIT_REF) so builds
  // that happen without a .git directory still report the correct SHA.
  if (process.env.COMMIT_REF) return process.env.COMMIT_REF.slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // Expose the build SHA to the client so errorLogService can report it as
    // app_version on every error row. NOTE: wrapped in JSON.stringify per
    // Vite's define-contract (raw string would be interpreted as an identifier).
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(resolveGitSha()),
  },
  build: {
    // "hidden" emits .map files next to the bundles but OMITS the
    // //# sourceMappingURL=... comment. Browsers never request maps in prod;
    // our post-build `strip-sourcemaps.mjs` then moves them out of dist/ so
    // Netlify never serves them publicly.
    sourcemap: "hidden",
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
