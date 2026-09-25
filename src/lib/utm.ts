const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

const SESSION_KEY = "kw_utm";
const ENTRY_KEY = "kw_entry_path";

export type UtmParams = Partial<Record<(typeof UTM_KEYS)[number], string>>;

/** Merkt sich UTM-Parameter und den ersten Einstieg (Pfad) der Sitzung. */
export function captureUtmParams(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const utm: UtmParams = {};
  let hasAny = false;

  for (const key of UTM_KEYS) {
    const val = params.get(key);
    if (val) {
      utm[key] = val;
      hasAny = true;
    }
  }

  try {
    if (hasAny) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(utm));
    }
    if (!sessionStorage.getItem(ENTRY_KEY)) {
      sessionStorage.setItem(ENTRY_KEY, window.location.pathname);
    }
  } catch {
    // Privater Modus / Speicher voll: Attribution ist nicht kritisch.
  }
}

export function getStoredUtm(): UtmParams {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Erster Pfad, auf dem captureUtmParams in dieser Sitzung lief (z. B. /formular). */
export function getEntryPath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(ENTRY_KEY);
  } catch {
    return null;
  }
}
