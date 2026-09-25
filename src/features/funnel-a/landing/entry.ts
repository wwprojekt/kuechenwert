export const FUNNEL_A_FIRST_STEP = "/funnel/a/kuechenform";
export const FUNNEL_A_AFTER_FORM_STEP = "/funnel/a/raum";

/**
 * Einstieg von /formular in Funnel A. Mit gewählter Form geht es direkt zu
 * Schritt 2, der Funnel übernimmt ?form= einmalig. Alle übrigen Parameter der
 * Landing-URL (utm_*, gclid, gbraid, wbraid, msclkid, fbclid, plz …) werden
 * durchgereicht, damit Attribution und PLZ-Vorbelegung im Funnel ankommen.
 */
export function funnelEntryUrl(search: string, formId?: string): string {
  const params = new URLSearchParams();
  if (formId) params.set("form", formId);
  new URLSearchParams(search).forEach((value, key) => {
    if (key !== "form") params.append(key, value);
  });
  const path = formId ? FUNNEL_A_AFTER_FORM_STEP : FUNNEL_A_FIRST_STEP;
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
