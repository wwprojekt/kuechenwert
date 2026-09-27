const PREFIX = "kw_submission_";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ID eines Absendeversuchs je Funnel. Bleibt über Wiederholungen und Neuladen
 * im Tab gleich, damit der Server eine doppelt gesendete Anfrage erkennt.
 */
export function submissionIdFor(funnel: string): string {
  const key = `${PREFIX}${funnel}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing && UUID_RE.test(existing)) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Nach erfolgreichem Absenden: die nächste Anfrage bekommt eine neue ID. */
export function clearSubmissionId(funnel: string): void {
  try {
    sessionStorage.removeItem(`${PREFIX}${funnel}`);
  } catch {
    // Speicher nicht verfügbar
  }
}
