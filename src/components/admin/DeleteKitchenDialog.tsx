/**
 * Confirmation dialog for deleting a kitchen in the admin panel
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";

interface KitchenToDelete {
  id: string;
  manufacturer: string;
  model: string;
}

interface DeleteKitchenDialogProps {
  kitchen: KitchenToDelete | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteKitchenDialog({
  kitchen,
  open,
  onOpenChange,
}: DeleteKitchenDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (kitchenId: string) => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session abgelaufen");

      // 1. Get all photos for this kitchen
      const { data: photos } = await supabase
        .from("kitchen_photos")
        .select("url")
        .eq("kitchen_id", kitchenId);

      // 2. Delete photos from storage
      if (photos && photos.length > 0) {
        const filePaths = photos
          .map((p) => {
            // Extract file path from URL
            const url = p.url;
            const match = url.match(/kitchen-photos\/(.+)$/);
            return match ? match[1] : null;
          })
          .filter((p): p is string => p !== null);

        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from("kitchen-photos")
            .remove(filePaths);

          if (storageError) {
            logger.error("Storage delete error:", storageError);
            // Continue anyway - photos might already be deleted
          }
        }
      }

      // 3. Delete photo records (cascade should handle this, but be explicit)
      const { error: photosError } = await supabase
        .from("kitchen_photos")
        .delete()
        .eq("kitchen_id", kitchenId);
      if (photosError) throw new Error(`Fotos konnten nicht gelöscht werden: ${photosError.message}`);

      // 4. Get related auctions
      const { data: auctions, error: auctionsQueryError } = await supabase
        .from("auctions")
        .select("id")
        .eq("kitchen_id", kitchenId);
      if (auctionsQueryError) throw new Error(`Auktionen konnten nicht abgefragt werden: ${auctionsQueryError.message}`);

      // 5. Delete bids for related auctions
      if (auctions && auctions.length > 0) {
        const auctionIds = auctions.map((a) => a.id);
        const { error: bidsError } = await supabase
          .from("bids")
          .delete()
          .in("auction_id", auctionIds);
        if (bidsError) throw new Error(`Gebote konnten nicht gelöscht werden: ${bidsError.message}`);
      }

      // 6. Delete auctions
      const { error: auctionsError } = await supabase
        .from("auctions")
        .delete()
        .eq("kitchen_id", kitchenId);
      if (auctionsError) throw new Error(`Auktionen konnten nicht gelöscht werden: ${auctionsError.message}`);

      // 7. Delete appointments
      const { error: appointmentsError } = await supabase
        .from("appointments")
        .delete()
        .eq("kitchen_id", kitchenId);
      if (appointmentsError) throw new Error(`Termine konnten nicht gelöscht werden: ${appointmentsError.message}`);

      // 8. Finally, delete the kitchen
      const { error } = await supabase
        .from("kitchens")
        .delete()
        .eq("id", kitchenId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminKitchens"] });
      queryClient.invalidateQueries({ queryKey: ["adminKitchenDetail"] });
      queryClient.invalidateQueries({ queryKey: ["myListings"] });
      toast({
        title: "Gelöscht",
        description: "Küche wurde erfolgreich gelöscht.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      logger.error("Delete error:", error);
      toast({
        title: "Fehler",
        description: "Küche konnte nicht gelöscht werden. Möglicherweise gibt es noch abhängige Daten.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (kitchen?.id) {
      deleteMutation.mutate(kitchen.id);
    }
  };

  if (!kitchen) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Küche löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Sind Sie sicher, dass Sie die Küche{" "}
            <strong>
              {kitchen.manufacturer} {kitchen.model}
            </strong>{" "}
            löschen möchten?
            <br />
            <br />
            Diese Aktion kann nicht rückgängig gemacht werden. Alle zugehörigen
            Fotos, Auktionen, Gebote und Termine werden ebenfalls gelöscht.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Abbrechen
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Wird gelöscht...
              </>
            ) : (
              "Endgültig löschen"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
