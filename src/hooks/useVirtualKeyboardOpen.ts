import { useEffect, useState } from "react";

/** Ab dieser Differenz zwischen Fenster und sichtbarem Bereich gilt die Bildschirmtastatur als offen. */
const KEYBOARD_MIN_PX = 140;

/**
 * true, solange die Bildschirmtastatur den sichtbaren Bereich verkleinert
 * (iOS Safari; Chrome auf Android verkleinert mit interactive-widget=
 * resizes-content das ganze Fenster, dort bleibt es false). Fixierte
 * Leisten am unteren Rand springen sonst über das Eingabefeld.
 */
export function useVirtualKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setOpen(viewport.scale <= 1.01 && window.innerHeight - viewport.height > KEYBOARD_MIN_PX);
    update();
    viewport.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      viewport.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return open;
}
