import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand/config";

type State =
  | { kind: "loading" }
  | { kind: "done"; scope: "werbung" | "hinweise" }
  | { kind: "invalid" }
  | { kind: "error" };

const DONE_TEXT: Record<"werbung" | "hinweise", string> = {
  werbung: `Sie erhalten keinen Newsletter und keine Werbe-E-Mails mehr von ${BRAND.name}.`,
  hinweise: `Sie erhalten keine allgemeinen Plattform-Hinweise mehr per E-Mail von ${BRAND.name}.`,
};

/** Liest den Token aus ?t= und entfernt ihn sofort aus Adresszeile und Verlauf. */
function takeTokenFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("t") ?? "";
  if (token) window.history.replaceState(window.history.state, "", "/abmelden");
  return token;
}

async function isInvalidToken(error: unknown): Promise<boolean> {
  if (!(error instanceof FunctionsHttpError)) return false;
  try {
    const body = await error.context.json();
    return body?.code === "invalid_token" || body?.code === "not_found";
  } catch {
    return false;
  }
}

const Abmelden = () => {
  const [state, setState] = useState<State>({ kind: "loading" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = takeTokenFromUrl();
    if (!token) {
      setState({ kind: "invalid" });
      return;
    }
    void (async () => {
      const { data, error } = await supabase.functions.invoke("kw-unsubscribe", { body: { token } });
      if (error) {
        setState({ kind: (await isInvalidToken(error)) ? "invalid" : "error" });
        return;
      }
      setState({ kind: "done", scope: data?.scope === "hinweise" ? "hinweise" : "werbung" });
    })();
  }, []);

  return (
    <PageLayout title={`Abmeldung – ${BRAND.name}`} description="Abmeldung von E-Mails" canonicalPath="/abmelden" noIndex>
      <div className="container max-w-xl py-16">
        <Card>
          <CardContent className="space-y-5 p-8 text-center">
            {state.kind === "loading" && (
              <>
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" aria-hidden="true" />
                <p className="text-muted-foreground" role="status">Ihre Abmeldung wird verarbeitet …</p>
              </>
            )}
            {state.kind === "done" && (
              <>
                <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
                <h1 className="text-2xl font-semibold">Sie sind abgemeldet</h1>
                <p className="text-muted-foreground">{DONE_TEXT[state.scope]}</p>
                <p className="text-sm text-muted-foreground">
                  Nachrichten zu Ihren Projekten, Angeboten und Rechnungen erhalten Sie weiterhin.
                </p>
              </>
            )}
            {state.kind === "invalid" && (
              <>
                <AlertTriangle className="mx-auto h-12 w-12 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <h1 className="text-2xl font-semibold">Link ungültig</h1>
                <p className="text-muted-foreground">
                  Dieser Abmeldelink ist ungültig oder unvollständig. Öffnen Sie den Link bitte direkt aus der E-Mail
                  oder verwalten Sie Ihre E-Mails in den Einstellungen.
                </p>
              </>
            )}
            {state.kind === "error" && (
              <>
                <AlertTriangle className="mx-auto h-12 w-12 text-destructive" aria-hidden="true" />
                <h1 className="text-2xl font-semibold">Abmeldung fehlgeschlagen</h1>
                <p className="text-muted-foreground">
                  Bitte versuchen Sie es später erneut oder schreiben Sie an{" "}
                  <a className="text-primary underline" href={`mailto:${BRAND.supportEmail}?subject=Abmelden`}>
                    {BRAND.supportEmail}
                  </a>
                  .
                </p>
              </>
            )}
            {state.kind !== "loading" && (
              <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
                <Button asChild variant="outline">
                  <Link to="/dashboard/settings">E-Mail-Einstellungen</Link>
                </Button>
                <Button asChild>
                  <Link to="/">Zur Startseite</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
};

export default Abmelden;
