import * as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";
import { logErrorToSupabase } from "@/lib/errorLogService";
import { getPageTitle } from "@/lib/germanErrors";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const _ACTION_TYPES = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof _ACTION_TYPES;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: ToasterToast["id"];
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: ToasterToast["id"];
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, "id">;

function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  // ── Session-Expired-Filter (höchste Priorität) ──────────────────────
  // Wenn invokeWithAuth() eine SessionExpiredError wirft, hat sessionGuard.ts
  // bereits den globalen SessionExpiredDialog ausgelöst. Der Aufrufer fängt den
  // Fehler aber typischerweise generisch (`catch (err) { toast({ description: err.message }) }`)
  // und würde dem Nutzer ein verwirrendes „SESSION_EXPIRED" zusätzlich zum Dialog zeigen.
  // Hier unterdrücken wir Toasts mit dieser Sentinel-Message komplett (kein Render, kein Log).
  const rawDescription = typeof props.description === 'string' ? props.description : '';
  const rawTitle = typeof props.title === 'string' ? props.title : '';
  if (
    props.variant === "destructive" &&
    (rawDescription === 'SESSION_EXPIRED' || rawTitle === 'SESSION_EXPIRED')
  ) {
    return { id, dismiss, update };
  }

  // ── Automatisches Error-Logging für destructive Toasts ──────────────
  // Jeder Fehler-Toast wird automatisch ins Fehlerprotokoll geschrieben,
  // ABER nur wenn der Fehler nicht bereits über handleAndLogError() geloggt wurde.
  // Duplikat-Erkennung: Wenn der Toast von einer Komponente kommt die handleAndLogError()
  // nutzt (z.B. VerkaufenWizard, Login, Kontakt), wird der Fehler bereits dort geloggt.
  // Der toast-auto-capture ist nur für Toasts gedacht die OHNE handleAndLogError() ausgelöst werden.
  if (props.variant === "destructive") {
    const errorMessage = typeof props.description === 'string'
      ? props.description
      : typeof props.title === 'string'
        ? props.title
        : 'Unbekannter Fehler (destructive toast)';

    const titleStr = typeof props.title === 'string' ? props.title : 'Fehler';

    // Duplikat-Vermeidung: Prüfe ob dieser Fehler kürzlich bereits geloggt wurde.
    // handleAndLogError() setzt einen Timestamp für die letzte geloggte Fehlermeldung.
    const lastLoggedError = (window as any).__lastLoggedErrorMessage;
    const lastLoggedTime = (window as any).__lastLoggedErrorTime || 0;
    const isDuplicate = lastLoggedError === errorMessage && (Date.now() - lastLoggedTime) < 5000;

    // Validierungsfehler erkennen: Bekannte UI-Hinweise die kein echtes Logging benötigen
    const validationPrefixes = [
      'Bitte', 'Unvollständige', 'Ungültig', 'Pflichtfeld',
      'Sie müssen', 'Passwort', 'Mindestens', 'Maximal',
    ];
    const validationTitles = [
      'Bitte überprüfen Sie Ihre Eingaben',
      'Unvollständige Angaben',
      'Fehlende Angaben',
      'Datei zu groß', 'File too large', 'Bild zu groß',
    ];
    const isValidationToast = validationPrefixes.some(prefix => errorMessage.startsWith(prefix))
      || validationTitles.some(t => titleStr === t);

    // Business-Events erkennen: Normale Geschäftsvorgänge die kein Fehler-Logging benötigen
    const businessEventTitles = [
      'Sie wurden überboten!',
      'Neues Gebot!',
      'Gebot fehlgeschlagen',
      'Ungültiges Gebot',
      'Ungültiger Betrag',
      'Auktion beendet',
      'Angebot abgelehnt',
      'Gegenangebot abgelehnt',
      'Anmeldung erforderlich',
      'Sitzung abgelaufen',
      'Nicht gefunden',
      'Gleiches Passwort',
      'Passwort bereits vergeben',
      'Zu viele Anfragen',
      'KI-Bewertung vorübergehend nicht verfügbar',
      'Dokument-Upload fehlgeschlagen',
      'Favorit konnte nicht',
    ];
    const businessEventDescriptions = [
      'Bieten Sie erneut!',
      'Bitte melden Sie sich an',
      'Ihre Sitzung ist abgelaufen',
      'muss sich vom bisherigen Passwort unterscheiden',
      'muss sich vom alten Passwort unterscheiden',
      'ist bereits Ihr aktuelles Passwort',
      'Bitte warten Sie einige Minuten',
      'Mindestgebot',
      'Gebot muss mindestens',
      'Gebot zu niedrig',
      'nach dem Login im Dashboard nachreichen',
      // Seller-seitige Pflichtfeld-Validierung beim Inserat-Edit / Dealer-
      // Listing-Create: juristische Mindestanforderungen (AGB §6.4 c), kein
      // echter Bug. Quelle: ListingEdit.tsx, DealerListingCreate.tsx und
      // RPC seller_update_listing_prices (ERRCODE 23514).
      'Mindestpreis ist Pflicht für Auktions-Inserate',
      'Sofortkauf-Preis ist Pflicht für Sofortkauf-Inserate',
      'Bearbeitung gesperrt: Die Auktion ist aktiv',
    ];
    const isBusinessEvent = businessEventTitles.some(t => titleStr.includes(t))
      || businessEventDescriptions.some(d => errorMessage.includes(d));

    // Navigator Lock-Fehler filtern (harmlos, Supabase Auth-JS Session-Synchronisierung)
    const lockErrorPatterns = [
      'Lock was stolen by another request',
      'Lock broken by another request',
      'released because another request stole it',
      'Lock acquisition timed out',
      'was not released within',
      'Acquiring an exclusive Navigator LockManager lock',
      'Acquiring process lock',
      'isAcquireTimeout',
      'Sitzungssynchronisierung',
      'lock request is aborted',
    ];
    const isLockError = lockErrorPatterns.some(p => errorMessage.includes(p) || titleStr.includes(p));

    if (!isDuplicate && !isValidationToast && !isBusinessEvent && !isLockError) {
      logErrorToSupabase({
        errorCode: 'TOAST_ERROR',
        errorMessage: `${titleStr}: ${errorMessage}`,
        errorCategory: 'unknown',
        severity: 'medium',
        pagePath: typeof window !== 'undefined' ? window.location.pathname : '/',
        pageTitle: typeof window !== 'undefined' ? getPageTitle(window.location.pathname) : 'Unbekannt',
        componentName: 'toast-auto-capture',
        originalError: errorMessage,
        errorSource: 'caught',
      }).catch(() => {
        // Fehler beim Auto-Logging dürfen die App nicht beeinflussen
      });
    }
  }

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

export { useToast, toast };
