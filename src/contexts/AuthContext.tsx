import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Prüft ob ein Fehler ein Navigator Lock-Fehler ist.
 * Diese Fehler sind harmlos und entstehen durch die Supabase Auth-JS
 * Session-Synchronisierung zwischen Tabs (Web Locks API).
 */
function isLockError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : '';
  return (
    message.includes('Lock broken by another request') ||
    message.includes('Lock was stolen by another request') ||
    message.includes('released because another request stole it') ||
    message.includes('Lock acquisition timed out') ||
    message.includes('was not released within') ||
    message.includes('Acquiring an exclusive Navigator LockManager lock') ||
    message.includes('Acquiring process lock') ||
    (error instanceof Error && 'isAcquireTimeout' in error && !!(error as any).isAcquireTimeout)
  );
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const intentionalSignOut = useRef(false);
  const retryCount = useRef(0);
  const MAX_RETRIES = 3;

  // Ref für session: Closures in Event-Listenern und Intervallen
  // lesen hieraus den aktuellen Wert, OHNE dass session als useEffect-Dependency
  // benötigt wird. Das verhindert das Re-Subscribe auf onAuthStateChange bei jedem
  // Token-Refresh (was sonst einen INITIAL_SESSION → setSession-Loop verursacht).
  const sessionRef = useRef<Session | null>(null);

  /**
   * Stabilisiert User-Referenz: setUser wird NUR aufgerufen wenn sich
   * die User-ID tatsächlich ändert (Login/Logout). Verhindert, dass alle
   * Hooks mit [user]-Dependency bei jedem Token-Refresh re-fetchen.
   */
  const updateAuthState = useCallback((newSession: Session | null) => {
    sessionRef.current = newSession;
    setSession(newSession);
    setUser(prev => {
      const newId = newSession?.user?.id ?? null;
      const prevId = prev?.id ?? null;
      if (newId === prevId) return prev; // Referenz beibehalten!
      return newSession?.user ?? null;
    });
  }, []);

  /**
   * Versucht die Session wiederherzustellen, z.B. wenn ein Refresh Token
   * in einem anderen Tab rotiert wurde und dieser Tab einen veralteten Token hat.
   * Wartet kurz und versucht dann getSession() erneut, da der andere Tab
   * den neuen Token bereits in localStorage geschrieben haben könnte.
   */
  const attemptSessionRecovery = useCallback(async (): Promise<boolean> => {
    if (retryCount.current >= MAX_RETRIES) {
      retryCount.current = 0;
      return false;
    }

    retryCount.current += 1;
    logger.log(`[Auth] Session-Recovery Versuch ${retryCount.current}/${MAX_RETRIES}...`);

    // Kurz warten - ein anderer Tab könnte gerade den Token refreshen
    // und den neuen Token in localStorage schreiben
    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount.current));

    try {
      const { data: { session: recoveredSession }, error } = await supabase.auth.getSession();
      
      if (recoveredSession && !error) {
        logger.log("[Auth] Session erfolgreich wiederhergestellt");
        retryCount.current = 0;
        updateAuthState(recoveredSession);
        return true;
      }

      // Versuche explizit einen Refresh
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshData?.session && !refreshError) {
        logger.log("[Auth] Session durch Refresh wiederhergestellt");
        retryCount.current = 0;
        updateAuthState(refreshData.session);
        return true;
      }
    } catch (e) {
      // Lock-Fehler sind harmlos und sollten nicht als Recovery-Fehler gewertet werden
      if (isLockError(e)) {
        logger.log("[Auth] Lock-Fehler bei Session-Recovery (harmlos, wird ignoriert)");
        // Bei Lock-Fehlern kurz warten und erneut versuchen
        await new Promise(resolve => setTimeout(resolve, 500));
        return attemptSessionRecovery();
      }
      console.warn("[Auth] Session-Recovery fehlgeschlagen:", e);
    }

    // Rekursiver Retry
    return attemptSessionRecovery();
  }, [updateAuthState]);

  useEffect(() => {
    // Set up auth state listener FIRST – wird nur EINMAL erstellt (keine session-Dependency!).
    // onAuthStateChange feuert INITIAL_SESSION bei jeder neuen Subscription.
    // Wenn session in deps wäre: setSession → re-run → neue Subscription → INITIAL_SESSION → loop.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        logger.log("[Auth] Event:", event, "Session:", !!currentSession);

        if (event === "SIGNED_OUT") {
          if (intentionalSignOut.current) {
            intentionalSignOut.current = false;
            retryCount.current = 0;
            updateAuthState(null);
            setLoading(false);
            return;
          }

          logger.log("[Auth] Unerwarteter SIGNED_OUT - versuche Recovery...");
          const recovered = await attemptSessionRecovery();
          
          if (!recovered) {
            logger.log("[Auth] Recovery fehlgeschlagen - User wird ausgeloggt");
            updateAuthState(null);
            setLoading(false);
          }
          return;
        }

        retryCount.current = 0;
        updateAuthState(currentSession);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession()
      .then(({ data: { session: existingSession } }) => {
        updateAuthState(existingSession);
        setLoading(false);
      })
      .catch((e) => {
        if (isLockError(e)) {
          logger.log("[Auth] Lock-Fehler beim initialen Session-Check (harmlos)");
        } else {
          console.warn("[Auth] Fehler beim initialen Session-Check:", e);
        }
        setLoading(false);
      });

    // Cross-Tab Session Sync
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.includes("auth-token")) {
        logger.log("[Auth] localStorage geändert (anderer Tab) - Session synchronisieren");
        supabase.auth.getSession()
          .then(({ data: { session: syncedSession } }) => {
            updateAuthState(syncedSession);
          })
          .catch((e) => {
            if (isLockError(e)) {
              logger.log("[Auth] Lock-Fehler bei Cross-Tab-Sync (harmlos)");
            } else {
              console.warn("[Auth] Fehler bei Cross-Tab-Sync:", e);
            }
          });
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Proaktiver Token-Refresh bei Tab-Wechsel.
    // Liest session aus sessionRef (nicht Closure!) → immer aktueller Wert.
    const handleVisibilityChange = () => {
      const currentSession = sessionRef.current;
      if (document.visibilityState === 'visible' && currentSession) {
        const expiresAt = currentSession.expires_at;
        const now = Math.floor(Date.now() / 1000);
        const bufferSeconds = 300; // 5 Minuten

        if (expiresAt && (expiresAt - now) < bufferSeconds) {
          logger.log("[Auth] Tab wieder sichtbar, Token läuft bald ab → proaktiver Refresh");
          supabase.auth.refreshSession()
            .then(({ data, error }) => {
              if (!error && data.session) {
                updateAuthState(data.session);
                logger.log("[Auth] Proaktiver Token-Refresh erfolgreich");
              } else if (error) {
                logger.warn("[Auth] Proaktiver Token-Refresh fehlgeschlagen:", error.message);
              }
            })
            .catch((e) => {
              if (!isLockError(e)) {
                logger.warn("[Auth] Proaktiver Token-Refresh Fehler:", e);
              }
            });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Periodischer Token-Refresh (Safety-Net für lang offene Tabs).
    // Liest session aus sessionRef statt Closure.
    const periodicRefreshInterval = setInterval(() => {
      const currentSession = sessionRef.current;
      if (document.visibilityState !== 'visible' || !currentSession) return;
      
      const expiresAt = currentSession.expires_at;
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt && (expiresAt - now) < 300) {
        logger.log("[Auth] Periodischer Token-Refresh (Token läuft bald ab)");
        supabase.auth.refreshSession()
          .then(({ data, error }) => {
            if (!error && data.session) {
              updateAuthState(data.session);
            }
          })
          .catch((e) => {
            if (!isLockError(e)) {
              logger.warn("[Auth] Periodischer Refresh fehlgeschlagen:", e);
            }
          });
      }
    }, 4 * 60 * 1000); // Alle 4 Minuten prüfen

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("storage", handleStorageChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(periodicRefreshInterval);
    };
  }, [attemptSessionRecovery, updateAuthState]);

  const signOut = async () => {
    intentionalSignOut.current = true;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // Lock-Fehler beim Abmelden ignorieren - der Benutzer wird trotzdem ausgeloggt
      if (!isLockError(e)) {
        console.warn("[Auth] Fehler beim Abmelden:", e);
      }
    }
    updateAuthState(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
