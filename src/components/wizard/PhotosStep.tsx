import { useCallback, useMemo, useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Camera, Upload, X, ImageIcon, Info, CheckCircle2, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";


interface PhotosStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  onSkipPhotos?: () => void;
}

export const PhotosStep = ({ formData, updateFormData, onSkipPhotos }: PhotosStepProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const photoUrls = useMemo(() => {
    return formData.photos.map((photo) => URL.createObjectURL(photo));
  }, [formData.photos]);

  useEffect(() => {
    return () => {
      photoUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoUrls]);

  const addValidFiles = useCallback(
    (files: File[]) => {
      const validFiles = files.filter(
        (file) => file.type.startsWith("image/") && file.size <= 100 * 1024 * 1024
      );
      if (validFiles.length === 0) return;
      const newPhotos = [...formData.photos, ...validFiles].slice(0, 30);
      updateFormData({ photos: newPhotos });
    },
    [formData.photos, updateFormData]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addValidFiles(Array.from(e.target.files || []));
      e.target.value = "";
    },
    [addValidFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    addValidFiles(Array.from(e.dataTransfer.files));
  }, [addValidFiles]);

  const removePhoto = useCallback(
    (index: number) => {
      const newPhotos = formData.photos.filter((_, i) => i !== index);
      updateFormData({ photos: newPhotos });
    },
    [formData.photos, updateFormData]
  );

  const hasPhotos = formData.photos.length > 0;

  return (
    <div className="space-y-3 sm:space-y-5 animate-fade-in">
      <div className="mb-2 sm:mb-4">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-1 sm:mb-2 flex items-center gap-2">
          <Camera className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Fotos Ihres {formData.vehicleType === 'Wohnwagen' ? 'Wohnwagens' : 'Wohnmobils'}
        </h2>
        <p className="text-xs sm:text-base text-muted-foreground">
          Fotos sind <strong>optional</strong> – Sie können sie jetzt hochladen oder jederzeit per E-Mail nachreichen
        </p>
      </div>

      {/* Reassurance + prominent skip CTA */}
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
        <p className="text-sm text-green-800 dark:text-green-200 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            {hasPhotos
              ? `${formData.photos.length} Foto${formData.photos.length !== 1 ? "s" : ""} hochgeladen – super! Mehr Fotos = bessere Angebote.`
              : "Kein Problem ohne Fotos – wir kontaktieren Sie und Sie können Fotos bequem per E-Mail nachreichen."
            }
          </span>
        </p>
      </div>

      {/* Prominent skip shortcut – ABOVE upload area for visibility */}
      {!hasPhotos && onSkipPhotos && (
        <button
          type="button"
          onClick={onSkipPhotos}
          className="w-full py-3 px-4 rounded-lg border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all flex items-center justify-center gap-2 text-sm font-medium text-primary"
        >
          Ohne Fotos fortfahren – Fotos per E-Mail nachreichen
          <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {/* Upload area – compact and friendly, supports drag & drop */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <label
          htmlFor="photo-upload"
          className="flex flex-col items-center justify-center py-4 sm:py-5 md:py-8 px-4 cursor-pointer"
        >
          <Upload className="w-8 h-8 text-muted-foreground mb-2" />
          <span className="text-base font-medium text-foreground mb-1">
            {hasPhotos ? "Weitere Fotos hinzufügen" : "Fotos hochladen"}
          </span>
          <span className="text-xs text-muted-foreground text-center">
            Klicken oder Dateien hierher ziehen
          </span>
          <input
            id="photo-upload"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </Card>

      {/* Photo preview */}
      {hasPhotos && (
        <div className="space-y-3">
          <Label className="text-base font-medium">
            {formData.photos.length} Foto{formData.photos.length !== 1 ? "s" : ""} hochgeladen
          </Label>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {photoUrls.map((url, index) => (
              <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border">
                <img
                  src={url}
                  alt={`Foto ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-2 md:p-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-md"
                >
                  <X className="w-4 h-4 md:w-3 md:h-3" />
                </button>
                {index === 0 && (
                  <span className="absolute bottom-1 left-1 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded">
                    Titelbild
                  </span>
                )}
              </div>
            ))}

            <label
              htmlFor="photo-upload-more"
              className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 flex flex-col items-center justify-center cursor-pointer transition-colors"
            >
              <Upload className="w-5 h-5 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">Mehr</span>
              <input
                id="photo-upload-more"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* Compact tips – less intimidating */}
      <details className="group">
        <summary className="text-sm font-medium flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
          <ImageIcon className="w-4 h-4" />
          Tipps für gute Fotos
          <span className="text-xs group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="mt-2 bg-muted/50 rounded-lg p-3 border border-border">
          <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
            <li>Außenansicht von allen 4 Seiten</li>
            <li>Innenraum: Wohnbereich, Küche, Bad</li>
            <li>Cockpit und Armaturenbrett</li>
            <li>Eventuelle Schäden oder Mängel</li>
          </ul>
        </div>
      </details>

      {/* Motivational stat – subtle, not pressuring */}
      {!hasPhotos && (
        <p className="text-xs text-center text-muted-foreground">
          <Info className="w-3 h-3 inline mr-1" />
          Tipp: Inserate mit Fotos erhalten durchschnittlich 3x mehr Händler-Anfragen
        </p>
      )}
    </div>
  );
};
