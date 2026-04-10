import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { z } from "zod";
import { germanZodErrorMap } from "./lib/germanErrors";
import { installGlobalErrorHandlers, initBreadcrumbTracking } from "./lib/errorLogService";
import "./lib/serviceWorker"; // Side-effect: auto-registers SW in production
import { AuthProvider } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import App from "./App.tsx";
import "./index.css";
import "flag-icons/css/flag-icons.min.css";

// Globale deutsche Fehlermeldungen für alle Zod-Validierungen setzen
z.setErrorMap(germanZodErrorMap);

// Globale Fehler-Handler installieren: Fängt ALLE ungefangenen Fehler
// und sendet sie an die error_logs Tabelle für das Admin-Dashboard
installGlobalErrorHandlers();
initBreadcrumbTracking();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <SettingsProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </SettingsProvider>
    </HelmetProvider>
  </StrictMode>
);
