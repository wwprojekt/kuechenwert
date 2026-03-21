import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { z } from "zod";
import { germanZodErrorMap } from "./lib/germanErrors";
import { AuthProvider } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import App from "./App.tsx";
import "./index.css";

// Globale deutsche Fehlermeldungen für alle Zod-Validierungen setzen
z.setErrorMap(germanZodErrorMap);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SettingsProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </SettingsProvider>
  </StrictMode>
);
