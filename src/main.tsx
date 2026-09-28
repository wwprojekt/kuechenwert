import "./lib/projectTokenBootstrap";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { z } from "zod";
import { germanZodErrorMap } from "./lib/germanErrors";
import { installGlobalErrorHandlers, initBreadcrumbTracking } from "./lib/errorLogService";
import { AuthProvider } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App.tsx";
import "@fontsource/fira-sans/latin-400.css";
import "@fontsource/fira-sans/latin-500.css";
import "@fontsource/fira-sans/latin-600.css";
import "@fontsource/fira-sans/latin-700.css";
import "@fontsource/fira-sans/latin-800.css";
import "@fontsource/fira-sans/latin-ext-400.css";
import "@fontsource/fira-sans/latin-ext-500.css";
import "@fontsource/fira-sans/latin-ext-600.css";
import "@fontsource/fira-sans/latin-ext-700.css";
import "@fontsource/fira-sans/latin-ext-800.css";
import "./index.css";

// Globale deutsche Fehlermeldungen für alle Zod-Validierungen setzen
z.setErrorMap(germanZodErrorMap);

// scripts/prerender.mjs setzt das Flag per Init-Skript: Beim Rendern zur
// Build-Zeit weder Service Worker noch Fehlerprotokoll an Supabase.
const isPrerender = (window as Window & { __KW_PRERENDER__?: boolean }).__KW_PRERENDER__ === true;

if (!isPrerender) {
  installGlobalErrorHandlers();
  initBreadcrumbTracking();
  // Side-effect: registriert den Service Worker in Production
  void import("./lib/serviceWorker");
}

// Auto-Reload bei lazy-chunk Ladefehlern.
//
// vite:preloadError feuert wenn ein <link rel="modulepreload"> oder die
// nachgelagerte dynamic import() einer Chunk-Datei fehlschlägt (404 oder
// Network-Error). Typischer Auslöser: User hatte alte index.html im Tab
// als ein neuer Build deployt wurde — die referenzierten Chunk-Hashes
// existieren auf dem Server nicht mehr.
//
// WICHTIG: event.preventDefault() darf hier NICHT aufgerufen werden!
// Vite's Preload-Helper:   return baseModule().catch(handlePreloadError)
// und handlePreloadError throwt nur wenn !defaultPrevented. Mit
// preventDefault() resolved die Promise mit `undefined`, React.lazy
// schreibt undefined in seinen `_result` und crasht beim Render mit
// "Cannot read properties of undefined (reading 'default')".
//
// Statt den Error zu schlucken planen wir nur den Reload als zweite
// Linie hinter lazyRetry — falls dort eine race condition auftritt
// (z.B. Mehrfach-Chunk-Failure in Folge). Vite throwt den Error normal
// weiter, lazyRetry fängt ihn und reloaded ebenfalls. Doppelter Reload
// ist idempotent; die sessionStorage-Flag verhindert Reload-Loops.
window.addEventListener("vite:preloadError", () => {
  if (sessionStorage.getItem("vite-preload-reload") === "1") {
    return;
  }
  sessionStorage.setItem("vite-preload-reload", "1");
  setTimeout(() => sessionStorage.removeItem("vite-preload-reload"), 10_000);
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <SettingsProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </SettingsProvider>
      </HelmetProvider>
    </ErrorBoundary>
  </StrictMode>
);
