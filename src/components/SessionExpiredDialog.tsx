import { useState, useCallback, createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isTokenValid } from "@/lib/sessionGuard";
import { logger } from "@/lib/logger";

interface SessionExpiredContextType {
  showSessionExpired: (redirectPath?: string) => void;
}

const SessionExpiredContext = createContext<SessionExpiredContextType>({
  showSessionExpired: () => {},
});

export function useSessionExpired() {
  return useContext(SessionExpiredContext);
}

export function SessionExpiredProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [redirectPath, setRedirectPath] = useState<string>("/dashboard");
  const [recovering, setRecovering] = useState(false);
  const navigate = useNavigate();

  const showSessionExpired = useCallback((path?: string) => {
    if (path) setRedirectPath(path);
    setOpen(true);
  }, []);

  const handleRetry = async () => {
    setRecovering(true);
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session?.access_token && isTokenValid(data.session.access_token)) {
        setOpen(false);
        setRecovering(false);
        // Session recovered, user can continue
        return;
      }
    } catch (e) {
      logger.warn('SessionExpiredDialog: Recovery failed', e);
    }
    setRecovering(false);
    // Recovery failed → redirect to login
    handleLogin();
  };

  const handleLogin = () => {
    setOpen(false);
    navigate(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  };

  return (
    <SessionExpiredContext.Provider value={{ showSessionExpired }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-orange-500" />
              Sitzung abgelaufen
            </DialogTitle>
            <DialogDescription className="text-left">
              Ihre Sitzung ist abgelaufen. Das passiert wenn der Browser-Tab lange
              inaktiv war oder Cookies gelöscht wurden. Bitte melden Sie sich
              erneut an – Ihre Daten gehen nicht verloren.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={recovering}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${recovering ? 'animate-spin' : ''}`} />
              {recovering ? "Versuche..." : "Erneut versuchen"}
            </Button>
            <Button onClick={handleLogin} className="w-full sm:w-auto">
              <LogIn className="mr-2 h-4 w-4" />
              Jetzt anmelden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SessionExpiredContext.Provider>
  );
}
