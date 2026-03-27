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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const intentionalSignOut = useRef(false);
  const retryCount = useRef(0);
  const MAX_RETRIES = 3;

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
        setSession(recoveredSession);
        setUser(recoveredSession.user);
        return true;
      }

      // Versuche explizit einen Refresh
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshData?.session && !refreshError) {
        logger.log("[Auth] Session durch Refresh wiederhergestellt");
        retryCount.current = 0;
        setSession(refreshData.session);
        setUser(refreshData.session.user);
        return true;
      }
    } catch (e) {
      console.warn("[Auth] Session-Recovery fehlgeschlagen:", e);
    }

    // Rekursiver Retry
    return attemptSessionRecovery();
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        logger.log("[Auth] Event:", event, "Session:", !!currentSession);

        if (event === "SIGNED_OUT") {
          // Nur sofort ausloggen wenn der User es selbst ausgelöst hat
          if (intentionalSignOut.current) {
            intentionalSignOut.current = false;
            retryCount.current = 0;
            setSession(null);
            setUser(null);
            setLoading(false);
            return;
          }

          // Unerwarteter Logout (z.B. Token-Refresh fehlgeschlagen)
          // Versuche die Session wiederherzustellen
          logger.log("[Auth] Unerwarteter SIGNED_OUT - versuche Recovery...");
          const recovered = await attemptSessionRecovery();
          
          if (!recovered) {
            logger.log("[Auth] Recovery fehlgeschlagen - User wird ausgeloggt");
            setSession(null);
            setUser(null);
            setLoading(false);
          }
          return;
        }

        // Alle anderen Events: Session normal aktualisieren
        retryCount.current = 0;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    });

    // Cross-Tab Session Sync: Wenn ein anderer Tab die Session aktualisiert,
    // wird das storage Event gefeuert und wir können die Session synchronisieren
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.includes("auth-token")) {
        logger.log("[Auth] localStorage geändert (anderer Tab) - Session synchronisieren");
        supabase.auth.getSession().then(({ data: { session: syncedSession } }) => {
          setSession(syncedSession);
          setUser(syncedSession?.user ?? null);
        });
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [attemptSessionRecovery]);

  const signOut = async () => {
    intentionalSignOut.current = true;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
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
