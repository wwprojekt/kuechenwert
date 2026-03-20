import { useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Camera, Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { optimizeImages, validateImageFile, OPTIMIZATION_PRESETS } from "@/lib/imageOptimization";
import { logger } from "@/lib/logger";

interface PhotoUploadStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
}

export const PhotoUploadStep = ({ formData, updateFormData }: PhotoUploadStepProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState(0);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;
    
    // Validate files
    const invalidFiles = files.filter(file => !validateImageFile(file).valid);
    if (invalidFiles.length > 0) {
      toast({
        title: "Ungültige Dateien",
        description: `${invalidFiles.length} Datei(en) sind ungültig oder zu groß`,
        variant: "destructive",
      });
      return;
    }

    // Check total count
    const totalPhotos = formData.photos.length + files.length;
    if (totalPhotos > 30) {
      toast({
        title: "Zu viele Fotos",
        description: "Maximal 30 Fotos sind erlaubt",
        variant: "destructive",
      });
      return;
    }

    setIsOptimizing(true);
    setOptimizationProgress(0);

    try {
      // Optimize images
      const optimizedImages = await optimizeImages(
        files,
        OPTIMIZATION_PRESETS.STANDARD,
        (progress) => {
          setOptimizationProgress(progress);
        }
      );

      // Convert optimized images back to File objects
      const optimizedFiles = optimizedImages.map(img => img.file);
      const newPhotos = [...formData.photos, ...optimizedFiles].slice(0, 30);
      
      updateFormData({ photos: newPhotos });

      // Show success message with compression stats
      const totalOriginalSize = optimizedImages.reduce((sum, img) => sum + img.originalSize, 0);
      const totalCompressedSize = optimizedImages.reduce((sum, img) => sum + img.compressedSize, 0);
      const avgCompression = Math.round(((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100);

      toast({
        title: "Fotos optimiert",
        description: `${optimizedImages.length} Foto(s) hinzugefügt. Größe um ${avgCompression}% reduziert.`,
      });

    } catch (error) {
      logger.error('Image optimization failed:', error);
      toast({
        title: "Optimierung fehlgeschlagen",
        description: "Die Fotos konnten nicht optimiert werden. Versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setIsOptimizing(false);
      setOptimizationProgress(0);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = formData.photos.filter((_, i) => i !== index);
    updateFormData({ photos: newPhotos });
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Camera className="w-6 h-6 text-primary" />
          Fotos hochladen
        </h2>
        <p className="text-muted-foreground">
          Laden Sie mindestens 4 hochwertige Fotos hoch (maximal 30)
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Upload Area */}
      <Card
        onClick={triggerFileInput}
        className="border-2 border-dashed border-border hover:border-primary transition-smooth cursor-pointer p-8 md:p-12 text-center"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="w-8 h-8 md:w-10 md:h-10 text-primary" />
          </div>
          <div>
            <p className="text-base md:text-lg font-medium mb-1">
              Klicken Sie hier oder ziehen Sie Dateien hierher
            </p>
            <p className="text-sm text-muted-foreground">
              JPG, PNG oder WebP (max. 10MB pro Datei)
            </p>
          </div>
          <Button type="button" variant="outline" className="mt-2">
            Fotos auswählen
          </Button>
        </div>
      </Card>

      {/* Inline error: not enough photos */}
      {formData.photos.length > 0 && formData.photos.length < 4 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
          <Camera className="w-4 h-4 flex-shrink-0" />
          Noch {4 - formData.photos.length} Foto(s) erforderlich (Minimum: 4)
        </div>
      )}
      {formData.photos.length === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium">
          <Camera className="w-4 h-4 flex-shrink-0" />
          Bitte laden Sie mindestens 4 Fotos hoch, um fortzufahren.
        </div>
      )}

      {/* Optimization Progress */}
      {isOptimizing && (
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="font-medium">Fotos werden optimiert...</span>
          </div>
          <Progress value={optimizationProgress} className="w-full" />
          <p className="text-sm text-muted-foreground mt-2">
            {optimizationProgress}% abgeschlossen
          </p>
        </Card>
      )}

      {/* Photo Preview Grid */}
      {formData.photos.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <Label className="text-base font-medium">
              Hochgeladene Fotos ({formData.photos.length}/30)
            </Label>
            {formData.photos.length >= 4 ? (
              <span className="text-sm text-primary flex items-center gap-1">
                ✓ Mindestanforderung erfüllt
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                Noch {4 - formData.photos.length} Foto(s) erforderlich
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
            {formData.photos.map((photo, index) => (
              <Card key={index} className="relative group aspect-square overflow-hidden transition-all hover:shadow-lg hover:border-primary/30">
                <img
                  src={URL.createObjectURL(photo)}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-smooth flex items-center justify-center">
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePhoto(index);
                    }}
                    className="shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
                  {index + 1}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-muted/50 rounded-lg p-4 border border-border space-y-2">
        <p className="font-medium flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary" />
          Tipps für bessere Fotos:
        </p>
        <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
          <li>Fotografieren Sie bei Tageslicht</li>
          <li>Zeigen Sie Außen- und Innenansichten</li>
          <li>Fotografieren Sie alle Räume und wichtige Details</li>
          <li>Verwenden Sie horizontale Aufnahmen</li>
          <li>Achten Sie auf gute Bildqualität (scharf, gut belichtet)</li>
        </ul>
      </div>
    </div>
  );
};
