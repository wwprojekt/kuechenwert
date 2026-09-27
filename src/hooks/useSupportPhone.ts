import { useSettings } from "@/contexts/SettingsContext";

export const FALLBACK_SUPPORT_PHONE = "+49 511 51532476";

/** Support-Telefon aus den Einstellungen, mit fester Rückfallnummer. */
export function useSupportPhone(): { display: string; href: string } {
  const { settings } = useSettings();
  const display = settings?.support_phone?.trim() || FALLBACK_SUPPORT_PHONE;
  return { display, href: `tel:${display.replace(/[^\d+]/g, "")}` };
}
