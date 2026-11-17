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
          .update(readFileSync(path.resolve(import.meta.dirname, "public/js", file)))
          .digest("hex")
          .slice(0, 10);
        return `<script src="/js/${file}?v=${hash}"></script>`;
      }),
  },
});

// Die Schriftschnitte der ersten Bildschirmhöhe vorladen: Dann zeichnet schon
// der erste Paint in Fira Sans, und wenn React die vorgerenderte Seite
// übernimmt, sind Texte gleich groß. Sonst wertet Google den minimal
// größeren Text als späteres LCP (Planer: 1,3 s → 3,2 s) und Texte springen.
const PRELOADED_FONT_WEIGHTS = [400, 600, 800];
const preloadFonts = (): Plugin => ({
  name: "kw-preload-fonts",
  apply: "build",
  transformIndexHtml: {
    order: "post",
    handler: (_html, ctx) =>
      Object.keys(ctx.bundle ?? {})
        .filter(
          (file) =>
            file.endsWith(".woff2") && PRELOADED_FONT_WEIGHTS.some((w) => file.includes(`fira-sans-latin-${w}-normal-`)),
        )
        .map((file) => ({
          tag: "link",
          attrs: { rel: "preload", href: `/${file}`, as: "font", type: "font/woff2", crossorigin: "" },
          injectTo: "head" as const,
        })),
  },
});

// font-display: optional statt swap: Ist Fira Sans in den ersten ~100 ms da
// (vorgeladen, ab der zweiten Seite aus dem Cache), zeichnet alles darin;
// sonst bleibt die Seite bei diesem Aufruf in der Ersatzschrift. So springt
// kein Text und React erzeugt beim Übernehmen keine größeren Texte, die Google
// als späteres LCP werten würde (Planer auf gedrosseltem Handy: 1,4 s → 3,2 s).
const fontDisplayOptional = (): Plugin => ({
  name: "kw-font-display-optional",
  enforce: "pre",
  transform(code, id) {
    if (!id.includes("@fontsource/fira-sans") || !id.endsWith(".css")) return null;
    return { code: code.replace(/font-display:\s*swap/g, "font-display: optional"), map: null };
  },
});

// Gehört ein Modul zu einem der Pakete? Unabhängig vom Pfadtrenner (Windows) und vom Layout des
// Paketmanagers (pnpm legt Pakete unter node_modules/.pnpm/<paket>@<version>/node_modules/<paket> ab).
const ausPaket =
  (...pakete: string[]) =>
  (id: string) => {
    const pfad = id.replaceAll("\\", "/");
    return pakete.some((paket) => pfad.includes(`/node_modules/${paket}`));
  };

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    versionPublicScripts(),
    preloadFonts(),
    fontDisplayOptional(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    // Browserziele wie mit Vite 5 (Vorgabe 'modules'): Seit Vite 7 hebt die Vorgabe sie auf
    // Safari 16.4 / Chrome 111 an, ältere iPhones und iPads bekämen dann womöglich eine leere Seite.
    // Ob die Ziele steigen dürfen, ist eine eigene Entscheidung (Werkzeug-Update 16.11.2026).
    target: ["es2020", "edge88", "firefox78", "chrome87", "safari14"],
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
          // conservative — anything used by Login/Register/Funnels/Hero
          // (vendor-forms, vendor-icons, vendor-query) MUST stay preloaded
          // to avoid a regression on the most common landing pages.
          if (dep.includes("vendor-recharts")) return false; // only AdminAnalytics
          if (dep.includes("vendor-editor")) return false; // only AdminBlog
          return true;
        }),
    },
    rolldownOptions: {
      output: {
        // Vendor-Chunks für langes Caching. Seit Vite 8 (Rolldown) als Gruppen statt manualChunks:
        // Eine Gruppe nimmt die Abhängigkeiten ihrer Module mit, soweit keine Gruppe mit höherer
        // Priorität sie schon hat. Mit der alten manualChunks-Funktion landete react-dom im
        // Editor-Chunk, und der Einstieg hing statisch an Editor und Diagrammen: Jede Seite hätte
        // beide geladen (500 statt 290 KiB gzip, Werkzeug-Update 16.11.2026).
        // scripts/check-entry-chunks.mjs prüft das nach jedem Build.
        codeSplitting: {
          groups: [
            // React core – rarely changes, excellent cache hit rate
            {
              name: "vendor-react",
              priority: 90,
              test: ausPaket("react/", "react-dom/", "react-router/"),
            },
            // Kleine Helfer, die App und Admin-Bibliotheken teilen. Ohne eigenen Chunk landen sie
            // in vendor-recharts bzw. vendor-editor, und der Einstieg lädt beide auf jeder Seite
            // (clsx allein zog 107 KB Diagramme, deren fast-equals weitere 119 KB Editor).
            {
              name: "vendor-utils",
              priority: 85,
              test: ausPaket("clsx/", "tailwind-merge/", "class-variance-authority/", "fast-equals/"),
            },
            // UI primitives (Radix + related)
            { name: "vendor-ui", priority: 80, test: ausPaket("@radix-ui/", "@floating-ui/") },
            // Data fetching and state management
            { name: "vendor-query", priority: 70, test: ausPaket("@tanstack/") },
            // Supabase client – separate chunk for backend SDK
            { name: "vendor-supabase", priority: 60, test: ausPaket("@supabase/") },
            // Form handling
            { name: "vendor-forms", priority: 50, test: ausPaket("react-hook-form/", "@hookform/", "zod/") },
            // Date utilities
            { name: "vendor-date", priority: 40, test: ausPaket("date-fns/") },
            // Icon library
            { name: "vendor-icons", priority: 30, test: ausPaket("lucide-react/") },
            // Diagramme (nur AdminAnalytics) und Editor (nur AdminBlog) kommen zuletzt, damit sie
            // keine Bibliothek an sich ziehen, die auch die übrigen Seiten laden.
            { name: "vendor-recharts", priority: 20, test: ausPaket("recharts/", "d3-", "victory-") },
            { name: "vendor-editor", priority: 10, test: ausPaket("@tiptap/", "prosemirror-", "@prosemirror/") },
            // Eigener Code, den jede Seite beim Start braucht, in einen Chunk (wie bisher im
            // Einstiegs-Chunk). Rolldown legt ihn sonst in ein Dutzend kleiner Dateien.
            { name: "app", priority: 0, tags: ["$initial"] },
          ],
        },
      },
    },
  },
}));
