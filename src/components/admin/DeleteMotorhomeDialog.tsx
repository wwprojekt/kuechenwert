/**
 * Confirmation dialog for deleting a motorhome in the admin panel
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
import { Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";

interface MotorhomeToDelete {
  id: string;
  manufacturer: string;
  model: string;
}

interface DeleteMotorhomeDialogProps {
  motorhome: MotorhomeToDelete | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteMotorhomeDialog({
  motorhome,
  open,
  onOpenChange,
}: DeleteMotorhomeDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (motorhomeId: string) => {
      // 1. Get all photos for this motorhome
      const { data: photos } = await supabase
        .from("motorhome_photos")
        .select("photo_url")
        .eq("motorhome_id", motorhomeId);

      // 2. Delete photos from storage
      if (photos && photos.length > 0) {
        const filePaths = photos
          .map((p) => {
            // Extract file path from URL
            const url = p.photo_url;
            const match = url.match(/motorhome-photos\/(.+)$/);
            return match ? match[1] : null;
          })
          .filter((p): p is string => p !== null);

        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from("motorhome-photos")
            .remove(filePaths);

          if (storageError) {
            logger.error("Storage delete error:", storageError);
            // Continue anyway - photos might already be deleted
          }
        }
      }

      // 3. Delete photo records (cascade should handle this, but be explicit)
      await supabase
        .from("motorhome_photos")
        .delete()
        .eq("motorhome_id", motorhomeId);

      // 4. Get related auctions
      const { data: auctions } = await supabase
        .from("auctions")
        .select("id")
        .eq("motorhome_id", motorhomeId);

      // 5. Delete bids for related auctions
      if (auctions && auctions.length > 0) {
        const auctionIds = auctions.map((a) => a.id);
        await supabase
          .from("bids")
          .delete()
          .in("auction_id", auctionIds);
      }

      // 6. Delete auctions
      await supabase
        .from("auctions")
        .delete()
        .eq("motorhome_id", motorhomeId);

      // 7. Delete appointments
      await supabase
        .from("appointments")
        .delete()
        .eq("motorhome_id", motorhomeId);

      // 8. Finally, delete the motorhome
      const { error } = await supabase
        .from("motorhomes")
        .delete()
        .eq("id", motorhomeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminMotorhomes"] });
      toast({
        title: "Gelöscht",
        description: "Wohnmobil wurde erfolgreich gelöscht.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      logger.error("Delete error:", error);
      toast({
        title: "Fehler",
        description: "Wohnmobil konnte nicht gelöscht werden. Möglicherweise gibt es noch abhängige Daten.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (motorhome?.id) {
      deleteMutation.mutate(motorhome.id);
    }
  };

  if (!motorhome) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Wohnmobil löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Sind Sie sicher, dass Sie das Wohnmobil{" "}
            <strong>
              {motorhome.manufacturer} {motorhome.model}
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
