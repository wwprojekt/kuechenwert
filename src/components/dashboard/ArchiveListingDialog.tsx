import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withSessionRetry } from "@/lib/sessionGuard";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Archive } from "lucide-react";

/**
 * ArchiveListingDialog
 *
 * Dialog für den "Archivieren / Vom Markt nehmen"-Pfad (Button 3 von 3 der
 * Soft-Brake-Mail). Setzt motorhomes.is_archived = TRUE. Das Inserat bleibt
 * in der DB (History, Audit), wird aber in allen Listen ausgeblendet:
 *   - /kaufen: läuft automatisch (Kaufen filtert über auctions.status=active,
 *     und archivierte Inserate haben keine aktive Auktion)
 *   - Dashboard /dashboard/listings: Client-Filter `is_archived=false`
 *     (Standard), User kann das Archiv per Toggle wieder einblenden
 *
 * Reversibel über seller_unarchive_listing (eigener „Wiederherstellen"-Button
 * im Detail-View wenn is_archived=TRUE).
 */
export function ArchiveListingDialog({
  open,
  onOpenChange,
  motorhomeId,
  motorhomeName,
  onArchived,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  motorhomeId: string;
  motorhomeName: string;
  onArchived?: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await withSessionRetry(
        () =>
          supabase.rpc("seller_archive_listing", {
            p_motorhome_id: motorhomeId,
          }),
        "archive_listing",
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motorhomeDetail", motorhomeId] });
      queryClient.invalidateQueries({ queryKey: ["myListings"] });
      toast({
        title: "Inserat archiviert",
        description: "Ihr Inserat ist vom Markt genommen und für potenzielle Käufer nicht mehr sichtbar. Sie können es jederzeit wiederherstellen.",
      });
      onArchived?.();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: "Archivierung fehlgeschlagen",
        description:
          err?.message ||
          "Das Inserat konnte nicht archiviert werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    },
    onSettled: () => setSubmitting(false),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-muted-foreground" />
            Inserat archivieren
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2 text-sm">
              <p>
                <strong>{motorhomeName}</strong> wird vom Markt genommen.
              </p>
              <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                <p className="font-medium text-foreground">Was passiert?</p>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li>Inserat wird in Such- und Kaufseiten ausgeblendet</li>
                  <li>Keine neuen Benachrichtigungen oder Favoriten-Mails</li>
                  <li>
                    Daten und Fotos bleiben erhalten — jederzeit wiederherstellbar
                  </li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                Sie finden archivierte Inserate in „Meine Inserate" über den Schalter
                <span className="mx-1 font-medium">Archiv anzeigen</span> wieder
                und können sie von dort erneut einstellen.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              setSubmitting(true);
              archiveMutation.mutate();
            }}
            disabled={submitting}
            className="bg-muted-foreground/80 hover:bg-muted-foreground text-white"
          >
            {submitting ? "Wird archiviert…" : "Jetzt archivieren"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
