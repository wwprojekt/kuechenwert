/**
 * Projektlink-Token (Capability-Link aus den Kunden-Mails).
 *
 * Der Token darf weder in der Adresszeile noch im Verlauf, in Statistiken oder
 * Fehlerprotokollen landen: Wer ihn kennt, kann Angebote annehmen oder das
 * Projekt beenden. captureProjectTokenFromUrl() läuft deshalb vor dem Start
 * der App, legt den Token tab-lokal in sessionStorage ab und ersetzt
 * /projekt/<token> durch /projekt.
 */

const STORAGE_KEY = "kw_project_token";
const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;
const PATH_RE = /^\/projekt\/([^/?#]+)\/?$/;

let memoryToken: string | null = null;

export function isProjectToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}

export function storeProjectToken(token: string): void {
  if (!isProjectToken(token)) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* Privater Modus ohne Storage: Token bleibt nur im Speicher der Seite. */
    memoryToken = token;
  }
}

export function getStoredProjectToken(): string | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (isProjectToken(value)) return value;
  } catch {
    /* Storage nicht verfügbar */
  }
  return memoryToken;
}

export function clearStoredProjectToken(): void {
  memoryToken = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Storage nicht verfügbar */
  }
}

/** Ersetzt /projekt/<token> vor dem ersten Rendern durch /projekt. */
export function captureProjectTokenFromUrl(): void {
  if (typeof window === "undefined") return;
  const match = PATH_RE.exec(window.location.pathname);
  if (!match) return;
  storeProjectToken(decodeURIComponent(match[1]));
  window.history.replaceState(window.history.state, "", `/projekt${window.location.search}${window.location.hash}`);
}

/** Entfernt Projekt-Tokens aus Pfaden und URLs für Statistik und Fehlerprotokolle. */
export function redactProjectToken(value: string): string {
  return value.replace(/\/projekt\/[A-Za-z0-9_-]{16,}/g, "/projekt");
}
