export type FunnelId = "a" | "b" | "c";

function normalize(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/**
 * Funnel zur Route: /formular ist Frage 1 von Funnel A, danach /funnel/a/:step.
 */
export function funnelForPath(pathname: string): FunnelId | null {
  const path = normalize(pathname);
  if (path === "/formular" || path === "/funnel/a" || path.startsWith("/funnel/a/")) return "a";
  if (path === "/funnel/b") return "b";
  if (path === "/funnel/c") return "c";
  return null;
}

/**
 * Fokusmodus: Auf den Funnel-Schritten und der Danke-Seite gibt es keine
 * Navigation, keinen großen Footer und keine schwebenden Buttons, und ein
 * Service-Worker-Update lädt die Seite nicht mitten im Formular neu.
 */
export function isFunnelPath(pathname: string): boolean {
  return funnelForPath(pathname) !== null || normalize(pathname) === "/funnel/danke";
}
