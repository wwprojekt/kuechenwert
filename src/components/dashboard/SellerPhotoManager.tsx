/**
 * Seller Photo Manager Component
 *
 * Provides photo management for sellers on the listing edit page:
 * - Drag & Drop reordering of photos
 * - Upload new photos (with file drop zone)
 * - Delete individual photos
 * - Set primary/title photo
 *
 * Uses @dnd-kit for accessible drag-and-drop sorting.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { optimizeImage, validateImageFile, OPTIMIZATION_PRESETS } from "@/lib/imageOptimization";
import { detectFromFile, HEIC_FAMILY } from "@/lib/imageMagicDetect";
import { withSessionRetry } from "@/lib/sessionGuard";
import { handleAndLogError } from "@/lib/errorLogService";

// dnd-kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
  Image as ImageIcon,
  Star,
  Loader2,
  Plus,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Photo {
  id: string;
  url: string;
  display_order: number | null;
}

interface SellerPhotoManagerProps {
  motorhomeId: string;
  photos: Photo[];
  queryKey: string[];
  disabled?: boolean;
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
  disabled,
}: {
  photo: Photo;
  index: number;
  onDelete: (photo: Photo) => void;
  onSetPrimary: (photo: Photo) => void;
  isDeleting: boolean;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id, disabled });

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
      {!disabled && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 z-10 bg-black/60 text-white rounded-md p-1.5 cursor-grab active:cursor-grabbing"
          title="Ziehen zum Sortieren"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}

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
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
            const parent = (e.target as HTMLImageElement).parentElement;
            if (parent) {
              const placeholder = document.createElement("div");
              placeholder.className =
                "w-full h-full flex items-center justify-center bg-muted";
              placeholder.innerHTML =
                '<span class="text-xs text-muted-foreground">Bild nicht verfügbar</span>';
              parent.appendChild(placeholder);
            }
          }}
        />
      </div>

      {/* Order Number */}
      <div className="absolute bottom-2 left-2 z-10 bg-black/60 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
        {index + 1}
      </div>

      {/* Action Buttons.
          Mobile (no hover): permanently visible so touch users can manage photos.
          Desktop (sm+): hidden by default, fade in on hover for a cleaner gallery look. */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {index !== 0 && !disabled && (
          <button
            type="button"
            onClick={() => onSetPrimary(photo)}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-md p-2 sm:p-1.5 shadow-md transition-colors min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
            title="Als Titelbild setzen"
            aria-label="Als Titelbild setzen"
          >
            <Star className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
        )}
        {!disabled && (
          <button
            type="button"
            onClick={() => onDelete(photo)}
            disabled={isDeleting}
            className="bg-red-500 hover:bg-red-600 text-white rounded-md p-2 sm:p-1.5 shadow-md transition-colors disabled:opacity-50 min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
            title="Foto löschen"
            aria-label="Foto löschen"
          >
            <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SellerPhotoManager({
  motorhomeId,
  photos: initialPhotos,
  queryKey,
  disabled = false,
}: SellerPhotoManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local state for photos (allows optimistic reordering)
  const [photos, setPhotos] = useState<Photo[]>(() =>
    [...initialPhotos].sort(
      (a, b) => (a.display_order ?? 999) - (b.display_order ?? 999)
    )
  );

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadedCount, setUploadedCount] = useState(0);
  const [totalUploadCount, setTotalUploadCount] = useState(0);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const [isFileDragging, setIsFileDragging] = useState(false);
  const isDragging = useRef(false);

  // Sync with parent when initialPhotos change (e.g. after refetch)
  useEffect(() => {
    if (!isDragging.current) {
      const sorted = [...initialPhotos].sort(
        (a, b) => (a.display_order ?? 999) - (b.display_order ?? 999)
      );
      setPhotos(sorted);
    }
  }, [initialPhotos]);

  // dnd-kit sensors (with touch support for mobile)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ---------------------------------------------------------------------------
  // Drag & Drop Handler
  // ---------------------------------------------------------------------------

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setPhotos((prev) => {
      const oldIndex = prev.findIndex((p) => p.id === active.id);
      const newIndex = prev.findIndex((p) => p.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      // Auto-save: trigger save after reorder
      setTimeout(() => autoSaveOrder(reordered), 0);
      return reordered;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Save Order Mutation (auto-save after drag)
  // ---------------------------------------------------------------------------

  const saveOrderMutation = useMutation({
    mutationFn: async (orderedPhotos: Photo[]) => {
      const updates = orderedPhotos.map((photo, index) => ({
        id: photo.id,
        display_order: index,
        is_primary: index === 0,
      }));

      const results = await Promise.all(
        updates.map(({ id, display_order, is_primary }) =>
          supabase
            .from("motorhome_photos")
            .update({ display_order, is_primary })
            .eq("id", id)
        )
      );

      const failed = results.filter((r) => r.error);
      if (failed.length > 0) {
        logger.error("Some photo order updates failed:", failed.map((r) => r.error));
        throw new Error(`${failed.length} von ${results.length} Updates fehlgeschlagen`);
      }
    },
    onSuccess: () => {
      toast({ title: "Reihenfolge gespeichert", description: "Die Foto-Reihenfolge wurde aktualisiert." });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      logger.error("Save photo order error:", error);
      toast({ title: "Fehler", description: "Reihenfolge konnte nicht gespeichert werden.", variant: "destructive" });
    },
  });

  const autoSaveOrder = useCallback(
    (orderedPhotos: Photo[]) => {
      saveOrderMutation.mutate(orderedPhotos);
    },
    [saveOrderMutation]
  );

  // ---------------------------------------------------------------------------
  // Set as Primary (move to first position)
  // ---------------------------------------------------------------------------

  const handleSetPrimary = useCallback((photo: Photo) => {
    setPhotos((prev) => {
      const index = prev.findIndex((p) => p.id === photo.id);
      if (index <= 0) return prev;
      const reordered = arrayMove(prev, index, 0);
      // Auto-save after setting primary
      setTimeout(() => autoSaveOrder(reordered), 0);
      return reordered;
    });
    toast({ title: "Titelbild geändert", description: "Das Titelbild wurde aktualisiert." });
  }, [toast]);

  // ---------------------------------------------------------------------------
  // Delete Photo Mutation
  // ---------------------------------------------------------------------------

  const deletePhotoMutation = useMutation({
    mutationFn: async (photo: Photo) => {
      // Extract storage path from URL
      const match = photo.url.match(/motorhome-photos\/(.+)$/);
      if (match) {
        const storagePath = match[1];
        const { error: storageError } = await supabase.storage
          .from("motorhome-photos")
          .remove([storagePath]);

        if (storageError) {
          logger.warn("Could not delete photo from storage:", storageError);
        }
      }

      // Delete DB record
      await withSessionRetry(async () => {
        const { error: dbError } = await supabase
          .from("motorhome_photos")
          .delete()
          .eq("id", photo.id);
        if (dbError) throw dbError;
      }, "SellerPhotoManager.deletePhoto");

      return photo.id;
    },
    onSuccess: (deletedId) => {
      setPhotos((prev) => prev.filter((p) => p.id !== deletedId));
      setPhotoToDelete(null);
      toast({ title: "Foto gelöscht", description: "Das Foto wurde erfolgreich entfernt." });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      handleAndLogError(error, {
        componentName: "SellerPhotoManager",
        category: "api",
        severity: "medium",
      });
      toast({ title: "Fehler", description: "Foto konnte nicht gelöscht werden.", variant: "destructive" });
      setPhotoToDelete(null);
    },
  });

  // ---------------------------------------------------------------------------
  // Upload New Photos
  // ---------------------------------------------------------------------------

  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      setIsUploading(true);
      setUploadedCount(0);
      setTotalUploadCount(fileArray.length);
      setUploadProgress("Fotos werden vorbereitet...");
      const newPhotos: Photo[] = [];

      try {
        for (let i = 0; i < fileArray.length; i++) {
          const file = fileArray[i];
          setUploadProgress(`Foto ${i + 1} von ${fileArray.length} wird hochgeladen...`);

          // Validate file
          const validation = validateImageFile(file);
          if (!validation.valid) {
            toast({ title: "Ungültiges Bild", description: `"${file.name}": ${validation.error}`, variant: "destructive" });
            continue;
          }

          // Magic-byte sniff: file.type lies on iOS Safari, and users
          // sometimes rename .HEIC to .jpeg. Trust only the bytes.
          const detected = await detectFromFile(file);
          if (HEIC_FAMILY.has(detected.format)) {
            toast({
              title: "HEIC nicht unterstützt",
              description: `"${file.name}": HEIC/HEIF wird von Browsern nicht angezeigt – bitte als JPG exportieren oder iPhone-Format auf 'Maximale Kompatibilität' stellen.`,
              variant: "destructive",
            });
            continue;
          }
          if (detected.format === "unknown") {
            toast({
              title: "Bildformat nicht erkannt",
              description: `"${file.name}": Datei ist kein erkanntes Bildformat.`,
              variant: "destructive",
            });
            continue;
          }

          // Optimize image before upload (converts to JPEG)
          let uploadFile: File;
          let fileExt: string;
          let contentType: string;
          try {
            const optimized = await optimizeImage(file, OPTIMIZATION_PRESETS.STANDARD);
            uploadFile = optimized.file;
            fileExt = optimized.format;
            contentType = uploadFile.type || `image/${fileExt}`;
          } catch (optimizeError) {
            // Optimization can fail on perfectly valid JPEGs (e.g. exotic
            // EXIF rotation). Since the magic-byte check already ruled out
            // HEIC, the original bytes are safe to upload — but use the
            // *detected* extension/MIME, never the user's filename.
            logger.warn(`Image optimization failed for ${file.name}, uploading original:`, optimizeError);
            uploadFile = file;
            fileExt = detected.extension;
            contentType = detected.mime;
          }
          const fileName = `${motorhomeId}/${Date.now()}_${i}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("motorhome-photos")
            .upload(fileName, uploadFile, {
              contentType,
              cacheControl: "31536000, immutable",
            });

          if (uploadError) {
            logger.error("Upload error:", uploadError);
            toast({ title: "Upload-Fehler", description: `"${file.name}" konnte nicht hochgeladen werden.`, variant: "destructive" });
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
            toast({ title: "Datenbankfehler", description: `"${file.name}" konnte nicht gespeichert werden.`, variant: "destructive" });
            continue;
          }

          newPhotos.push(photoRecord);
          setUploadedCount(i + 1);
        }

        if (newPhotos.length > 0) {
          setPhotos((prev) => [...prev, ...newPhotos]);
          toast({
            title: "Fotos hochgeladen",
            description: `${newPhotos.length} Foto${newPhotos.length > 1 ? "s" : ""} erfolgreich hochgeladen.`,
          });
          queryClient.invalidateQueries({ queryKey });
        }
      } catch (error) {
        handleAndLogError(error, {
          componentName: "SellerPhotoManager",
          category: "api",
          severity: "high",
        });
        toast({ title: "Fehler", description: "Beim Hochladen ist ein Fehler aufgetreten.", variant: "destructive" });
      } finally {
        setIsUploading(false);
        setUploadProgress("");
        setUploadedCount(0);
        setTotalUploadCount(0);
      }
    },
    [motorhomeId, photos.length, queryClient, queryKey, toast]
  );

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        handleUpload(files);
      }
      // Reset input so same file can be selected again
      event.target.value = "";
    },
    [handleUpload]
  );

  // ---------------------------------------------------------------------------
  // File Drop Zone Handlers
  // ---------------------------------------------------------------------------

  const handleFileDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDragging(true);
  }, []);

  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDragging(false);
  }, []);

  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsFileDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        // Filter to only image files (also accept HEIC/HEIF with empty/wrong MIME type)
        const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'heif', 'bmp', 'tiff', 'tif'];
        const imageFiles = Array.from(files).filter((f) => {
          if (f.type.startsWith("image/")) return true;
          // Fallback: check file extension for HEIC/HEIF files with wrong MIME
          const ext = f.name.split('.').pop()?.toLowerCase() || '';
          return imageExtensions.includes(ext);
        });
        if (imageFiles.length > 0) {
          handleUpload(imageFiles);
        } else {
          toast({ title: "Ungültige Dateien", description: "Bitte nur Bilddateien hochladen (JPG, PNG, WebP, HEIC).", variant: "destructive" });
        }
      }
    },
    [handleUpload, toast]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Fotos verwalten</h3>
          <p className="text-sm text-muted-foreground">
            {photos.length} Foto{photos.length !== 1 ? "s" : ""} vorhanden
          </p>
        </div>
        <div className="flex gap-2">
          {/* Upload Button */}
          {!disabled && (
            <label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer gap-2"
                disabled={isUploading}
                asChild
              >
                <span>
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {isUploading ? "Lädt hoch..." : "Fotos hinzufügen"}
                </span>
              </Button>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,image/*"
                multiple
                onChange={handleFileInputChange}
                className="hidden"
                disabled={isUploading}
              />
            </label>
          )}

              {/* Auto-save indicator */}
          {saveOrderMutation.isPending && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Speichert...</span>
            </div>
          )}
        </div>
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            <span className="flex-1">{uploadProgress || "Fotos werden hochgeladen..."}</span>
            {totalUploadCount > 0 && (
              <span className="font-medium">
                {uploadedCount}/{totalUploadCount}
              </span>
            )}
          </div>
          {totalUploadCount > 1 && (
            <div className="w-full bg-blue-100 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(5, (uploadedCount / totalUploadCount) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {photos.length === 0 ? (
        /* Empty State with Upload Zone */
        <label
          className={`flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isFileDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onDragEnter={handleFileDragEnter}
          onDragLeave={handleFileDragLeave}
          onDragOver={handleFileDragOver}
          onDrop={handleFileDrop}
        >
          <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
          {isFileDragging ? (
            <p className="text-primary font-medium mb-4">
              Lassen Sie die Fotos hier los
            </p>
          ) : (
            <>
              <p className="text-muted-foreground mb-2">Keine Fotos vorhanden</p>
              <p className="text-sm text-muted-foreground mb-4">
                Ziehen Sie Fotos hierher oder klicken Sie zum Auswählen
              </p>
            </>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,image/*"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
            disabled={isUploading}
          />
        </label>
      ) : (
        <div className="space-y-4">
          {/* File Drop Zone */}
          {!disabled && (
            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center text-sm transition-colors ${
                isFileDragging
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-muted-foreground/20 text-muted-foreground"
              }`}
              onDragEnter={handleFileDragEnter}
              onDragLeave={handleFileDragLeave}
              onDragOver={handleFileDragOver}
              onDrop={handleFileDrop}
            >
              {isFileDragging
                ? "Lassen Sie die Fotos hier los"
                : "Weitere Fotos hierher ziehen oder oben auf \"Fotos hinzufügen\" klicken"}
            </div>
          )}

          {/* Photo Grid with Drag & Drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={() => {
              isDragging.current = true;
            }}
            onDragEnd={(event) => {
              isDragging.current = false;
              handleDragEnd(event);
            }}
            onDragCancel={() => {
              isDragging.current = false;
            }}
          >
            <SortableContext
              items={photos.map((p) => p.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {photos.map((photo, index) => (
                  <SortablePhotoItem
                    key={photo.id}
                    photo={photo}
                    index={index}
                    onDelete={setPhotoToDelete}
                    onSetPrimary={handleSetPrimary}
                    isDeleting={deletePhotoMutation.isPending}
                    disabled={disabled}
                  />
                ))}

                {/* Add More Photos Tile */}
                {!disabled && (
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
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,image/*"
                      multiple
                      onChange={handleFileInputChange}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </label>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}



      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!photoToDelete}
        onOpenChange={(open) => !open && setPhotoToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Foto löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Foto wird unwiderruflich gelöscht. Diese Aktion kann nicht
              rückgängig gemacht werden.
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
    </div>
  );
}
