/**
 * Admin Photo Manager Component
 * 
 * Provides full photo management for motorhomes in the admin panel:
 * - Drag & Drop reordering of photos
 * - Upload new photos
 * - Delete individual photos (with confirmation)
 * - Set primary/title photo
 * 
 * Uses @dnd-kit for accessible drag-and-drop sorting.
 */

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { optimizeImage, validateImageFile, OPTIMIZATION_PRESETS } from "@/lib/imageOptimization";

// dnd-kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// UI imports
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Trash2,
  GripVertical,
  Save,
  Image as ImageIcon,
  Star,
  Loader2,
  X,
  Plus,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Photo {
  id: string;
  url: string;
  display_order: number | null;
  is_primary: boolean | null;
}

interface AdminPhotoManagerProps {
  motorhomeId: string;
  photos: Photo[];
  queryKey: string[];
}

// ---------------------------------------------------------------------------
// Sortable Photo Item
// ---------------------------------------------------------------------------

function SortablePhotoItem({
  photo,
  index,
  onDelete,
  onSetPrimary,
  isDeleting,
}: {
  photo: Photo;
  index: number;
  onDelete: (photo: Photo) => void;
  onSetPrimary: (photo: Photo) => void;
  isDeleting: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
        isDragging
          ? "border-primary shadow-xl scale-105"
          : index === 0
          ? "border-primary/50 shadow-md"
          : "border-border hover:border-primary/30"
      }`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 bg-black/60 text-white rounded-md p-1.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        title="Ziehen zum Sortieren"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Primary Badge */}
      {index === 0 && (
        <Badge className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-primary text-white text-xs">
          <Star className="w-3 h-3 mr-1" />
          Titelbild
        </Badge>
      )}

      {/* Photo */}
      <div className="aspect-square">
        <img
          src={photo.url}
          alt={`Foto ${index + 1}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Order Number */}
      <div className="absolute bottom-2 left-2 z-10 bg-black/60 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
        {index + 1}
      </div>

      {/* Action Buttons */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {index !== 0 && (
          <button
            type="button"
            onClick={() => onSetPrimary(photo)}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-md p-1.5 shadow-md transition-colors"
            title="Als Titelbild setzen"
          >
            <Star className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(photo)}
          disabled={isDeleting}
          className="bg-red-500 hover:bg-red-600 text-white rounded-md p-1.5 shadow-md transition-colors disabled:opacity-50"
          title="Foto löschen"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AdminPhotoManager({
  motorhomeId,
  photos: initialPhotos,
  queryKey,
}: AdminPhotoManagerProps) {
  const queryClient = useQueryClient();

  // Local state for photos (allows optimistic reordering)
  const [photos, setPhotos] = useState<Photo[]>(() =>
    [...initialPhotos].sort(
      (a, b) => (a.display_order ?? 999) - (b.display_order ?? 999)
    )
  );
  const [hasOrderChanged, setHasOrderChanged] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);

  // Sync with parent when initialPhotos change (e.g. after refetch)
  // We only sync if we haven't made local changes
  // useEffect is intentionally omitted to avoid overwriting drag state

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ---------------------------------------------------------------------------
  // Drag & Drop Handler
  // ---------------------------------------------------------------------------

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setPhotos((prev) => {
        const oldIndex = prev.findIndex((p) => p.id === active.id);
        const newIndex = prev.findIndex((p) => p.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
      setHasOrderChanged(true);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Save Order Mutation
  // ---------------------------------------------------------------------------

  const saveOrderMutation = useMutation({
    mutationFn: async () => {
      // Update display_order for each photo
      const updates = photos.map((photo, index) => ({
        id: photo.id,
        display_order: index,
        is_primary: index === 0,
      }));

      // Use Promise.all for parallel updates
      await Promise.all(
        updates.map(({ id, display_order, is_primary }) =>
          supabase
            .from("motorhome_photos")
            .update({ display_order, is_primary })
            .eq("id", id)
        )
      );
    },
    onSuccess: () => {
      toast.success("Reihenfolge gespeichert");
      setHasOrderChanged(false);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      logger.error("Save photo order error:", error);
      toast.error("Fehler beim Speichern der Reihenfolge");
    },
  });

  // ---------------------------------------------------------------------------
  // Delete Photo Mutation
  // ---------------------------------------------------------------------------

  const deletePhotoMutation = useMutation({
    mutationFn: async (photo: Photo) => {
      // 1. Extract storage path from URL (consistent with DeleteMotorhomeDialog)
      const match = photo.url.match(/motorhome-photos\/(.+)$/);
      if (match) {
        const storagePath = match[1];
        const { error: storageError } = await supabase.storage
          .from("motorhome-photos")
          .remove([storagePath]);

        if (storageError) {
          logger.warn("Could not delete photo from storage:", storageError);
          // Continue anyway - DB record is more important
        }
      }

      // 2. Delete DB record
      const { error: dbError } = await supabase
        .from("motorhome_photos")
        .delete()
        .eq("id", photo.id);

      if (dbError) throw dbError;

      return photo.id;
    },
    onSuccess: (deletedId) => {
      setPhotos((prev) => prev.filter((p) => p.id !== deletedId));
      setPhotoToDelete(null);
      toast.success("Foto gelöscht");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      logger.error("Delete photo error:", error);
      toast.error("Fehler beim Löschen des Fotos");
      setPhotoToDelete(null);
    },
  });

  // ---------------------------------------------------------------------------
  // Set as Primary (move to first position)
  // ---------------------------------------------------------------------------

  const handleSetPrimary = useCallback((photo: Photo) => {
    setPhotos((prev) => {
      const index = prev.findIndex((p) => p.id === photo.id);
      if (index <= 0) return prev;
      return arrayMove(prev, index, 0);
    });
    setHasOrderChanged(true);
    toast.info("Foto als Titelbild gesetzt – bitte Reihenfolge speichern");
  }, []);

  // ---------------------------------------------------------------------------
  // Upload New Photos
  // ---------------------------------------------------------------------------

  const handleUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      setIsUploading(true);
      const newPhotos: Photo[] = [];

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          // Validate file using project's image validation
          const validation = validateImageFile(file);
          if (!validation.valid) {
            toast.error(`"${file.name}": ${validation.error}`);
            continue;
          }

          const fileExt = file.name.split(".").pop();
          const fileName = `${motorhomeId}/${Date.now()}_${i}.${fileExt}`;

          // Optimize image before upload
          const optimized = await optimizeImage(file, OPTIMIZATION_PRESETS.STANDARD);
          const uploadFile = optimized.file;

          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from("motorhome-photos")
            .upload(fileName, uploadFile);

          if (uploadError) {
            logger.error("Upload error:", uploadError);
            toast.error(`Fehler beim Hochladen von "${file.name}"`);
            continue;
          }

          // Get public URL
          const {
            data: { publicUrl },
          } = supabase.storage.from("motorhome-photos").getPublicUrl(fileName);

          // Insert DB record
          const newOrder = photos.length + newPhotos.length;
          const { data: photoRecord, error: dbError } = await supabase
            .from("motorhome_photos")
            .insert({
              motorhome_id: motorhomeId,
              url: publicUrl,
              display_order: newOrder,
              is_primary: photos.length === 0 && newPhotos.length === 0,
            })
            .select()
            .single();

          if (dbError) {
            logger.error("DB insert error:", dbError);
            toast.error(`Fehler beim Speichern von "${file.name}"`);
            continue;
          }

          newPhotos.push(photoRecord);
        }

        if (newPhotos.length > 0) {
          setPhotos((prev) => [...prev, ...newPhotos]);
          toast.success(
            `${newPhotos.length} Foto${newPhotos.length > 1 ? "s" : ""} hochgeladen`
          );
          queryClient.invalidateQueries({ queryKey });
        }
      } catch (error) {
        logger.error("Upload batch error:", error);
        toast.error("Fehler beim Hochladen der Fotos");
      } finally {
        setIsUploading(false);
        // Reset input so same file can be selected again
        event.target.value = "";
      }
    },
    [motorhomeId, photos.length, queryClient, queryKey]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Fotos verwalten
            </CardTitle>
            <CardDescription>
              {photos.length} Foto{photos.length !== 1 ? "s" : ""} vorhanden
              {" · "}Ziehen Sie Fotos zum Sortieren
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {/* Upload Button */}
            <label>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={isUploading}
                asChild
              >
                <span>
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  {isUploading ? "Lädt hoch..." : "Fotos hinzufügen"}
                </span>
              </Button>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleUpload}
                className="hidden"
                disabled={isUploading}
              />
            </label>

            {/* Save Order Button */}
            {hasOrderChanged && (
              <Button
                size="sm"
                onClick={() => saveOrderMutation.mutate()}
                disabled={saveOrderMutation.isPending}
              >
                {saveOrderMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Reihenfolge speichern
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {photos.length === 0 ? (
          /* Empty State with Upload Zone */
          <label className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-muted-foreground/25 rounded-lg hover:border-primary/50 cursor-pointer transition-colors">
            <Upload className="w-12 h-12 text-muted-foreground mb-4" />
            <span className="text-lg font-medium mb-1">Fotos hochladen</span>
            <span className="text-sm text-muted-foreground">
              Klicken oder Dateien hierher ziehen (max. 100 MB pro Bild)
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              className="hidden"
              disabled={isUploading}
            />
          </label>
        ) : (
          /* Photo Grid with Drag & Drop */
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={photos.map((p) => p.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {photos.map((photo, index) => (
                  <SortablePhotoItem
                    key={photo.id}
                    photo={photo}
                    index={index}
                    onDelete={setPhotoToDelete}
                    onSetPrimary={handleSetPrimary}
                    isDeleting={deletePhotoMutation.isPending}
                  />
                ))}

                {/* Add More Photos Tile */}
                <label className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 flex flex-col items-center justify-center cursor-pointer transition-colors">
                  {isUploading ? (
                    <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-8 h-8 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">
                        Mehr Fotos
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Hint */}
        {photos.length > 0 && (
          <p className="text-xs text-muted-foreground mt-4">
            Das erste Foto wird automatisch als Titelbild verwendet. Ziehen Sie
            Fotos per Drag & Drop in die gewünschte Reihenfolge und klicken Sie
            auf „Reihenfolge speichern".
          </p>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!photoToDelete}
        onOpenChange={(open) => !open && setPhotoToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Foto löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Foto wird unwiderruflich aus dem Speicher und der Datenbank
              gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {photoToDelete && (
            <div className="my-4 rounded-lg overflow-hidden border max-h-48">
              <img
                src={photoToDelete.url}
                alt="Zu löschendes Foto"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePhotoMutation.isPending}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                photoToDelete && deletePhotoMutation.mutate(photoToDelete)
              }
              className="bg-destructive hover:bg-destructive/90"
              disabled={deletePhotoMutation.isPending}
            >
              {deletePhotoMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
