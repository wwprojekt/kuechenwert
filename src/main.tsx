import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { z } from "zod";
import { germanZodErrorMap } from "./lib/germanErrors";
import { installGlobalErrorHandlers, initBreadcrumbTracking } from "./lib/errorLogService";
import "./lib/serviceWorker"; // Side-effect: auto-registers SW in production
import { AuthProvider } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App.tsx";
import "./index.css";

// Globale deutsche Fehlermeldungen für alle Zod-Validierungen setzen
z.setErrorMap(germanZodErrorMap);

installGlobalErrorHandlers();
initBreadcrumbTracking();

// Auto-Reload bei lazy-chunk Ladefehlern.
//
// Wenn Dokploy ein neues Build deployt, ist die index.html ggf. schon mit den
// neuen Asset-Hashes ausgeliefert, bevor die Chunks selbst hochgeladen sind
// (atomisches Replacement gibt es bei Dokploy/Docker-Volume-Mounts nicht).
// User die in dem 30-90s Fenster klicken bekommen einen 404 für ihren Chunk.
// Cloudflare cached diesen 404 mit max-age=31536000 (Asset-Cache-Header) und
// die Page bleibt fuer diesen Edge-PoP fuer Stunden kaputt.
//
// vite:preloadError feuert sobald ein dynamic import 404 oder Network-Error
// liefert. Wir reloaden dann die Page → Browser holt frische index.html mit
// den dann mittlerweile korrekten Hashes. User sieht max. 1-2s Flicker.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
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
