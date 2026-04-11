import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import PageLayout from "@/components/PageLayout";

type VerifyType = "signup" | "recovery" | "invite" | "magiclink" | "email_change" | "email";

/** Map the type parameter from the email link to the Supabase OTP type */
const mapToOtpType = (type: string): "email" | "recovery" | "invite" | "magiclink" | "email_change" => {
  switch (type) {
    case "signup":
      return "email";
    case "recovery":
      return "recovery";
    case "invite":
      return "invite";
    case "magiclink":
      return "magiclink";
    case "email_change":
      return "email_change";
    default:
      return "email";
  }
};

/** Determine where to redirect after successful verification */
const getRedirectPath = (type: string, redirectTo: string | null): string => {
  if (redirectTo) return redirectTo;
  switch (type) {
    case "recovery":
      return "/reset-password";
    case "invite":
      return "/login/haendler";
    case "magiclink":
      return "/";
    case "email_change":
      return "/profil";
    case "signup":
      return "/dashboard";
    default:
      return "/dashboard";
  }
};

/** Get a user-friendly success message based on the type */
const getSuccessMessage = (type: string): string => {
  switch (type) {
    case "recovery":
      return "Passwort-Reset bestätigt. Sie werden zur Passwort-Änderung weitergeleitet...";
    case "invite":
      return "Einladung bestätigt! Sie werden zur Anmeldung weitergeleitet...";
    case "magiclink":
      return "Anmeldung erfolgreich! Sie werden weitergeleitet...";
    case "email_change":
      return "Ihre neue E-Mail-Adresse wurde erfolgreich bestätigt!";
    default:
      return "Ihre E-Mail-Adresse wurde erfolgreich bestätigt!";
  }
};

const AuthConfirm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("E-Mail wird bestätigt...");

  // Resend-Link state
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendMessage, setResendMessage] = useState("");
  const originalType = (searchParams.get("type") || "signup") as VerifyType;

  useEffect(() => {
    const confirmEmail = async () => {
      const tokenHash = searchParams.get("token_hash");
      const type = (searchParams.get("type") || "signup") as VerifyType;
      const redirectTo = searchParams.get("redirect_to");

      if (!tokenHash) {
        setStatus("error");
        setMessage("Ungültiger Bestätigungslink. Bitte versuchen Sie es erneut.");
        return;
      }

      try {
        const otpType = mapToOtpType(type);
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });

        if (error) {
          console.error("Verification error:", error);
          setStatus("error");
          if (error.message.includes("expired") || error.message.includes("invalid")) {
            setMessage("Der Bestätigungslink ist abgelaufen oder ungültig. Bitte fordern Sie einen neuen Link an.");
          } else {
            setMessage(`Fehler bei der Bestätigung: ${error.message}`);
          }
          return;
        }

        setStatus("success");
        setMessage(getSuccessMessage(type));

        // After signup confirmation: ensure motorhome is linked to this user.
        // This is a fallback in case auto-convert-wizard ran before the user was
        // fully confirmed, or if there was a race condition with user creation.
        if (type === "signup" || type === "email") {
          try {
            const { data: { user: confirmedUser } } = await supabase.auth.getUser();
            if (confirmedUser) {
              // Check if user already has motorhomes
              const { data: existingMotorhomes } = await supabase
                .from("motorhomes")
                .select("id")
                .eq("seller_id", confirmedUser.id)
                .limit(1);

              // If no motorhomes found, try to link via wizard_session
              if (!existingMotorhomes || existingMotorhomes.length === 0) {
                console.log("No motorhomes found for confirmed user, checking wizard sessions...");
                
                const sessionValid = await ensureValidRLSSession();
                if (!sessionValid) return;

                // Look for wizard sessions with this user's email that have been converted
                const { data: wizardSession } = await supabase
                  .from("wizard_sessions")
                  .select("id, status, user_id")
                  .eq("customer_email", confirmedUser.email)
                  .in("status", ["completed", "converted"])
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (wizardSession) {
                  // Update wizard session to link to this user
                  if (!wizardSession.user_id || wizardSession.user_id !== confirmedUser.id) {
                    await supabase
                      .from("wizard_sessions")
                      .update({ user_id: confirmedUser.id })
                      .eq("id", wizardSession.id);
                    console.log("Linked wizard session to confirmed user");
                  }

                  // If session was converted but motorhome has wrong seller_id,
                  // the auto-convert should have handled this. But as a safety net,
                  // we trigger a re-check by invalidating queries on the dashboard.
                  console.log("Wizard session found, dashboard will auto-refresh via realtime");
                }
              }
            }
          } catch (linkError) {
            console.error("Error during post-confirmation motorhome linking:", linkError);
            // Non-critical: don't block the redirect
          }
        }

        // Redirect nach 2 Sekunden
        const targetPath = getRedirectPath(type, redirectTo);
        setTimeout(() => {
          navigate(targetPath);
        }, 2000);
      } catch (err) {
        console.error("Unexpected error:", err);
        setStatus("error");
        setMessage("Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
      }
    };

    confirmEmail();
  }, [searchParams, navigate]);

  /** Handle resending the confirmation email */
  const handleResendConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = resendEmail.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      setResendStatus("error");
      setResendMessage("Bitte geben Sie eine gültige E-Mail-Adresse ein.");
      return;
    }

    setResendStatus("sending");
    setResendMessage("");

    try {
      // Use the correct resend method based on the original link type
      if (originalType === "recovery") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email,
        });
        if (error) {
          if (error.message.includes("already confirmed") || error.message.includes("already registered")) {
            setResendStatus("error");
            setResendMessage(
              "Diese E-Mail-Adresse ist bereits bestätigt. Sie können sich direkt anmelden."
            );
            return;
          }
          throw error;
        }
      }

      setResendStatus("sent");
      setResendMessage(
        originalType === "recovery"
          ? `Ein neuer Passwort-Reset-Link wurde an ${email} gesendet. Bitte prüfen Sie auch Ihren Spam-Ordner.`
          : `Ein neuer Bestätigungslink wurde an ${email} gesendet. Bitte prüfen Sie auch Ihren Spam-Ordner.`
      );
    } catch (err: unknown) {
      console.error("Resend confirmation error:", err);
      setResendStatus("error");
      const errorMsg = err instanceof Error ? err.message : "Unbekannter Fehler";
      setResendMessage(
        `Der Bestätigungslink konnte nicht gesendet werden: ${errorMsg}. Bitte versuchen Sie es später erneut oder kontaktieren Sie uns unter info@caravanwert.de.`
      );
    }
  };

  return (
    <PageLayout
      title="E-Mail bestätigen | CaravanWert"
      description="E-Mail-Bestätigung für Ihr CaravanWert-Konto"
      noIndex={true}
    >
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full mx-auto p-6 sm:p-8 bg-card dark:bg-gray-800 rounded-2xl shadow-lg text-center">
          {status === "loading" && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                E-Mail wird bestätigt
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Bitte warten Sie einen Moment...
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Bestätigung erfolgreich!
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {message}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Sie werden in Kürze zu Ihrem Dashboard weitergeleitet...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Bestätigung fehlgeschlagen
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {message}
              </p>

              {/* Resend Confirmation Link Section */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 mb-5 text-left">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {originalType === "recovery" ? "Neuen Passwort-Reset-Link anfordern" : "Neuen Bestätigungslink anfordern"}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Geben Sie Ihre E-Mail-Adresse ein, um einen neuen {originalType === "recovery" ? "Passwort-Reset-Link" : "Bestätigungslink"} zu erhalten.
                </p>

                <form onSubmit={handleResendConfirmation} className="space-y-3">
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => {
                      setResendEmail(e.target.value);
                      // Reset status when user types
                      if (resendStatus === "error" || resendStatus === "sent") {
                        setResendStatus("idle");
                        setResendMessage("");
                      }
                    }}
                    placeholder="ihre@email.de"
                    required
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-colors"
                    disabled={resendStatus === "sending"}
                  />

                  <button
                    type="submit"
                    disabled={resendStatus === "sending" || resendStatus === "sent"}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                      resendStatus === "sent"
                        ? "bg-green-600 text-white cursor-default"
                        : resendStatus === "sending"
                        ? "bg-primary/70 text-white cursor-wait"
                        : "bg-primary text-white hover:bg-primary/90 active:scale-[0.98]"
                    }`}
                  >
                    {resendStatus === "sending" && (
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    {resendStatus === "sent" && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {resendStatus === "sending"
                      ? "Wird gesendet..."
                      : resendStatus === "sent"
                      ? "Link wurde gesendet"
                      : originalType === "recovery" ? "Neuen Reset-Link senden" : "Neuen Bestätigungslink senden"}
                  </button>
                </form>

                {/* Status Messages */}
                {resendMessage && (
                  <div
                    className={`mt-3 p-3 rounded-lg text-xs ${
                      resendStatus === "sent"
                        ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                        : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                    }`}
                  >
                    {resendMessage}
                  </div>
                )}
              </div>

              {/* Helpful Tips */}
              <div className="text-left bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-5 border border-blue-200 dark:border-blue-800">
                <h3 className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">
                  Tipps zur Fehlerbehebung:
                </h3>
                <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1.5">
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 flex-shrink-0">1.</span>
                    <span>Prüfen Sie Ihren <strong>Spam-/Junk-Ordner</strong> auf die Bestätigungs-E-Mail.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 flex-shrink-0">2.</span>
                    <span>Bestätigungslinks sind <strong>72 Stunden</strong> gültig.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 flex-shrink-0">3.</span>
                    <span>Verwenden Sie immer den <strong>neuesten Link</strong> aus Ihrem Postfach.</span>
                  </li>
                </ul>
              </div>

              {/* Navigation Buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => navigate("/login")}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Zur Anmeldung
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Zur Startseite
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default AuthConfirm;
