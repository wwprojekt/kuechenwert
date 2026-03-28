/**
 * Email Verification Banner
 * Shown at the top of the seller dashboard when the user's email
 * has not been confirmed yet. Provides a resend button and explains
 * why verification is important.
 *
 * Design follows the same pattern as PendingDealerBanner for consistency.
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, RefreshCw, AlertCircle, CheckCircle2, Shield } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmailVerificationBannerProps {
  email: string;
}

export default function EmailVerificationBanner({ email }: EmailVerificationBannerProps) {
  const { toast } = useToast();
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      setSent(true);
      toast({
        title: "Bestätigungslink gesendet!",
        description: "Bitte prüfen Sie Ihr E-Mail-Postfach und Ihren Spam-Ordner.",
      });
    } catch {
      toast({
        title: "Fehler",
        description: "Die Bestätigungs-E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 dark:border-amber-700 overflow-hidden">
      {/* Main Banner */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
            <Mail className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
              <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100">
                E-Mail-Adresse bestätigen
              </h3>
              <Badge className="bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200 border-0 w-fit">
                <AlertCircle className="w-3 h-3 mr-1" />
                Ausstehend
              </Badge>
            </div>

            <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
              Wir haben eine Bestätigungs-E-Mail an{" "}
              <strong className="font-semibold">{email}</strong> gesendet.
              Bitte klicken Sie auf den Link in der E-Mail, um Ihr Konto zu aktivieren.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              {sent ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-green-400 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/30 cursor-default"
                  disabled
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  E-Mail wurde erneut gesendet
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleResend}
                  disabled={resending}
                  className="bg-amber-600 hover:bg-amber-700 text-white shadow-md"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${resending ? "animate-spin" : ""}`} />
                  {resending ? "Wird gesendet..." : "Bestätigungslink erneut senden"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Info Bar */}
      <div className="bg-amber-100/50 dark:bg-amber-900/20 px-5 py-3 border-t border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
          <Shield className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Nach der Bestätigung können Sie Ihr Inserat vollständig verwalten, Fotos hochladen und Ihr Fahrzeug an Händler vermitteln lassen.
          </span>
        </div>
      </div>
    </div>
  );
}
