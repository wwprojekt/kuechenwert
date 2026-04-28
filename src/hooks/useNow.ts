/**
 * useNow — globaler 1-Hz "now"-Hook
 *
 * Hintergrund:
 * KitchenCard hatte pro Karte ein eigenes `setInterval(updateTimer, 1000)` mit
 * 5 setState-Calls pro Tick. Bei 12 sichtbaren Karten = 12 Timer × 5 setState = 60
 * setState pro Sekunde. React 18 batcht zwar, das ist aber unnötige CPU-Last und
 * verursacht spürbares Jank beim Scrollen auf älteren Devices.
 *
 * Lösung: EIN globaler Timer für die gesamte App. Alle Subscriber bekommen den
 * neuen Timestamp via setState gepusht. Wenn keine Subscriber mehr aktiv sind,
 * wird der Timer automatisch gestoppt — kein Wakeup-Drain im Hintergrund.
 *
 * Implementierung bewusst module-level statt Context, damit:
 *   - kein Provider-Pflicht-Wrap nötig ist (drop-in einsetzbar)
 *   - tree-weite Re-Renders vermieden werden (nur Komponenten die `useNow`
 *     aufrufen rendern, nicht das ganze Untertree)
 */

import { useEffect, useState } from 'react';

const subscribers = new Set<(now: number) => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;
let lastTick = Date.now();

function ensureInterval() {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    lastTick = Date.now();
    // Snapshot subscribers, damit unsubscribe während eines Ticks die Iteration
    // nicht durcheinanderbringt.
    const snapshot = Array.from(subscribers);
    for (const cb of snapshot) cb(lastTick);
  }, 1000);
}

function maybeStopInterval() {
  if (intervalId !== null && subscribers.size === 0) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Liefert einen "now"-Timestamp, der sich einmal pro Sekunde aktualisiert.
 * Nutzung: `const now = useNow();` und damit z. B. Restzeit berechnen.
 */
export function useNow(): number {
  const [now, setNow] = useState<number>(lastTick);

  useEffect(() => {
    subscribers.add(setNow);
    ensureInterval();
    // Sofort auf den aktuellsten Tick syncen, damit ein gerade gemounteter
    // Consumer nicht bis zum nächsten Tick auf einen evtl. veralteten
    // lastTick warten muss.
    if (now !== lastTick) setNow(lastTick);

    return () => {
      subscribers.delete(setNow);
      maybeStopInterval();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Effect läuft 1× per Mount
  }, []);

  return now;
}
