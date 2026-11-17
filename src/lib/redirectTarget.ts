/**
 * Ziel einer Weiterleitung aus der Adresse (`/login?redirect=…`, `/auth/confirm?redirect_to=…`):
 * nur eigene Pfade. Erlaubt ist, was mit genau einem „/“ beginnt und auf dieser Seite bleibt;
 * `//fremd.de`, `/\fremd.de`, Schemata (`https:`, `javascript:`), Backslashes, Leer- und
 * Steuerzeichen fallen weg (Browser streichen Tab und Zeilenumbruch, aus `/\t/fremd.de` würde
 * `//fremd.de`). `null` heißt: das Startziel der Seite nehmen.
 *
 * Bis 17.11.2026 gaben Login und AuthConfirm den Parameter ungeprüft an navigate(); mit einem Link
 * `/login?redirect=//fremd.de` zielte die Weiterleitung nach der Anmeldung auf eine fremde Adresse
 * (die Browser-History des Routers weicht bei einer Adresse, die pushState ablehnt, auf
 * `window.location` aus).
 */
export function safeRedirectPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if ([...value].some((c) => c === "\\" || c <= " " || c === "\u007f")) return null;
  try {
    const base = "https://ziel.invalid";
    return new URL(value, base).origin === base ? value : null;
  } catch {
    return null;
  }
}
