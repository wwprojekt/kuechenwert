/**
 * Vorgerenderte Seiten (scripts/prerender.mjs) sollen sofort sichtbar sein und
 * es bleiben: main.tsx sichert vor dem Start der App das HTML der Route
 * (Element mit data-kw-route), RouteFallback zeigt es beim ersten Laden als
 * Suspense-Platzhalter, bis der Seiten-Chunk geladen ist. Ohne das würde
 * createRoot die fertige Seite durch einen Lade-Spinner ersetzen.
 */

let initialRouteHtml: string | null = null;

/** Liest das vorgerenderte Seiten-HTML; null bei SPA-Shell oder alter Vorschau ohne Markierung. */
export function captureInitialRouteHtml(root: HTMLElement): string | null {
  const route = root.querySelector<HTMLElement>("[data-kw-route]");
  const html = route?.innerHTML.trim() ? route.innerHTML : null;
  initialRouteHtml = html;
  return html;
}

export function peekInitialRouteHtml(): string | null {
  return initialRouteHtml;
}

/** Nach dem ersten Laden gelten wieder die normalen Lade-Platzhalter. */
export function releaseInitialRouteHtml(): void {
  initialRouteHtml = null;
}
