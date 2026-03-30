/**
 * SetPasswordDialog - Modal dialog that prompts new users to set a password
 * after they arrive via the registration magic link.
 *
 * Triggered by the URL parameter ?setup=password in the dashboard.
 * The dialog cannot be closed without setting a password (no X button, no backdrop close).
 */

import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { handleValidationError, handleAuthError } from "@/lib/errorLogService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Lock, Loader2, CheckCircle2, Eye, EyeOff, ShieldCheck, PartyPopper } from "lucide-react";

const passwordSchema = z.object({
  password: z.string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
    .regex(/[A-Z]/, "Passwort muss mindestens einen Großbuchstaben enthalten")
    .regex(/[a-z]/, "Passwort muss mindestens einen Kleinbuchstaben enthalten")
    .regex(/[0-9]/, "Passwort muss mindestens eine Zahl enthalten"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwörter stimmen nicht überein",
  path: ["confirmPassword"],
});

interface SetPasswordDialogProps {
  open: boolean;
}

const SetPasswordDialog = ({ open }: SetPasswordDialogProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const getPasswordStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[a-z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(password);
  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-green-500"];
  const strengthLabels = ["Sehr schwach", "Schwach", "Mittel", "Stark", "Sehr stark"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = passwordSchema.parse({ password, confirmPassword });

      const { error } = await supabase.auth.updateUser({
        password: validated.password,
      });

      if (error) throw error;

      setIsSuccess(true);
      toast({
        title: "Passwort festgelegt",
        description: "Ihr Passwort wurde erfolgreich gespeichert. Sie können sich ab jetzt damit einloggen.",
      });

      // Remove the setup=password parameter and close dialog after 3 seconds
      setTimeout(() => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("setup");
        setSearchParams(newParams, { replace: true });
        // Navigate to dashboard overview
        navigate("/dashboard", { replace: true });
      }, 3000);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const germanMessage = handleValidationError(error, "SetPasswordDialog");
        toast({
          title: "Bitte überprüfen Sie Ihre Eingabe",
          description: germanMessage,
          variant: "destructive",
        });
      } else {
        logger.error("Password set error:", error);
        const germanMessage = handleAuthError(error, "SetPasswordDialog");
        toast({
          title: "Passwort konnte nicht gespeichert werden",
          description: germanMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {/* Prevent closing without setting password */}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        // Hide the X close button via CSS
        hideCloseButton
      >
        {isSuccess ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <PartyPopper className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <DialogHeader className="text-center">
              <DialogTitle className="text-xl text-center">
                Willkommen bei CaravanWert!
              </DialogTitle>
              <DialogDescription className="text-center">
                Ihr Passwort wurde gespeichert. Sie werden gleich zu Ihrem Dashboard weitergeleitet.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Sie können sich ab jetzt mit E-Mail und Passwort einloggen.</span>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle>Passwort festlegen</DialogTitle>
                  <DialogDescription>
                    Legen Sie jetzt ein Passwort fest, damit Sie sich jederzeit wieder einloggen können.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="set-password">Neues Passwort</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="set-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mindestens 8 Zeichen"
                    className="pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password strength indicator */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            i < passwordStrength ? strengthColors[passwordStrength - 1] : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Passwortstärke: {strengthLabels[passwordStrength - 1] || "Sehr schwach"}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="set-confirm-password">Passwort bestätigen</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="set-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Passwort wiederholen"
                    className="pl-10 pr-10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="text-xs text-destructive">
                    Passwörter stimmen nicht überein
                  </p>
                )}
              </div>

              {/* Password requirements */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  Passwort-Anforderungen
                </p>
                <ul className="text-xs text-muted-foreground space-y-0.5 ml-5">
                  <li className={password.length >= 8 ? "text-green-600" : ""}>
                    Mindestens 8 Zeichen
                  </li>
                  <li className={/[A-Z]/.test(password) ? "text-green-600" : ""}>
                    Mindestens ein Großbuchstabe
                  </li>
                  <li className={/[a-z]/.test(password) ? "text-green-600" : ""}>
                    Mindestens ein Kleinbuchstabe
                  </li>
                  <li className={/[0-9]/.test(password) ? "text-green-600" : ""}>
                    Mindestens eine Zahl
                  </li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading || password !== confirmPassword || passwordStrength < 3}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Wird gespeichert...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Passwort festlegen
                  </>
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SetPasswordDialog;
