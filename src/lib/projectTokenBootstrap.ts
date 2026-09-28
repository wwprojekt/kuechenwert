import { captureProjectTokenFromUrl } from "@/features/marketplace/project-token";

// Erster Import in main.tsx: läuft vor Router, Statistik und Fehlerprotokoll.
captureProjectTokenFromUrl();
