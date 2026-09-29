import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { Phone } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { SiteLogo } from "@/components/SiteLogo";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSupportPhone } from "@/hooks/useSupportPhone";
import { trackActiveFunnelEvent } from "@/lib/funnelTelemetry";
import { trackPhoneClick } from "@/lib/gadsConversionService";
import { trackMetaPhoneClick } from "@/lib/metaPixelService";
import { cn } from "@/lib/utils";

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export const SAVED_IN_TAB =
  "Ihre Angaben bleiben in diesem Browser-Tab gespeichert. Solange Sie ihn nicht schließen, können Sie später genau hier weitermachen.";

interface FunnelHeaderProps {
  /** Logo-Klick fragt nach, bevor der Funnel verlassen wird. */
  guardExit?: boolean;
  /** Neuladen oder Schließen warnt, weil sonst Angaben verloren gehen. */
  guardUnload?: boolean;
  /** Wo die Angaben bleiben, für den Hinweis im Dialog. */
  savedHint?: string;
  /** Zusatz vor der Telefonnummer. */
  aside?: ReactNode;
  /** Zweite Zeile im Kopf, z. B. die Schrittnavigation im Planer. */
  children?: ReactNode;
  containerClassName?: string;
}

/**
 * Kopf im Fokusmodus der Funnels: nur Logo und Support-Telefon, keine
 * Navigation. Wer mitten im Funnel auf das Logo klickt, wird gefragt.
 */
export function FunnelHeader({
  guardExit = false,
  guardUnload = false,
  savedHint = SAVED_IN_TAB,
  aside,
  children,
  containerClassName = "section-container",
}: FunnelHeaderProps) {
  const phone = useSupportPhone();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [exitOpen, setExitOpen] = useState(false);
  const leaving = useRef(false);

  useEffect(() => {
    if (!guardUnload) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [guardUnload]);

  const onLogoClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!guardExit) return;
    event.preventDefault();
    leaving.current = false;
    setExitOpen(true);
    trackActiveFunnelEvent("exit_intent");
  };

  const onExitOpenChange = (open: boolean) => {
    if (!open && !leaving.current) trackActiveFunnelEvent("exit_cancelled");
    setExitOpen(open);
  };

  const leave = () => {
    leaving.current = true;
    trackActiveFunnelEvent("exit_confirmed");
    navigate("/");
  };

  const onPhoneClick = () => {
    trackPhoneClick(phone.display, pathname);
    trackMetaPhoneClick();
    trackActiveFunnelEvent("help_clicked", { channel: "phone" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className={cn(containerClassName, "flex h-14 items-center justify-between gap-3 sm:h-16")}>
        <Link to="/" onClick={onLogoClick} className={cn("rounded-lg transition-opacity hover:opacity-90", FOCUS_RING)}>
          <SiteLogo variant="icon-text-compact" asLink={false} iconSize="h-8 w-8 sm:h-9 sm:w-9" />
        </Link>
        <div className="flex items-center gap-3">
          {aside}
          <a
            href={phone.href}
            onClick={onPhoneClick}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 sm:text-sm",
              FOCUS_RING,
            )}
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Fragen? </span>
            <span className="hidden min-[380px]:inline">{phone.display}</span>
            <span className="sr-only min-[380px]:hidden">Anrufen: {phone.display}</span>
          </a>
        </div>
      </div>
      {children}

      <AlertDialog open={exitOpen} onOpenChange={onExitOpenChange}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl sm:rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-bold tracking-tight-2">Anfrage unterbrechen?</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">{savedHint}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-2 flex flex-col gap-2">
            <AlertDialogPrimitive.Cancel className={cn("btn-primary w-full", FOCUS_RING)}>Weiter ausfüllen</AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action onClick={leave} className={cn("btn-ghost w-full text-ink-muted", FOCUS_RING)}>
              Zur Startseite
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
