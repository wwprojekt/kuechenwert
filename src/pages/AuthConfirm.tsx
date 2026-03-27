import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
            setMessage("Der Bestätigungslink ist abgelaufen oder ungültig. Bitte fordern Sie einen neuen an.");
          } else {
            setMessage(`Fehler bei der Bestätigung: ${error.message}`);
          }
          return;
        }

        setStatus("success");
        setMessage(getSuccessMessage(type));

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

  return (
    <PageLayout
      title="E-Mail bestätigen | CaravanWert"
      description="E-Mail-Bestätigung für Ihr CaravanWert-Konto"
      noIndex={true}
    >
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md w-full mx-auto p-8 bg-card dark:bg-gray-800 rounded-2xl shadow-lg text-center">
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
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {message}
              </p>
              <button
                onClick={() => navigate("/login")}
                className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Zur Anmeldung
              </button>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default AuthConfirm;
