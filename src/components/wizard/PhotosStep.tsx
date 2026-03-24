import { useCallback, useMemo, useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Camera, Upload, X, ImageIcon, Info } from "lucide-react";
import { Card } from "@/components/ui/card";


interface PhotosStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
}

export const PhotosStep = ({ formData, updateFormData }: PhotosStepProps) => {
  const [skipPhotos, setSkipPhotos] = useState(false);

  const photoUrls = useMemo(() => {
    return formData.photos.map((photo) => URL.createObjectURL(photo));
  }, [formData.photos]);

  useEffect(() => {
    return () => {
      photoUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoUrls]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const validFiles = files.filter(
        (file) => file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024
      );
      const newPhotos = [...formData.photos, ...validFiles].slice(0, 30);
      updateFormData({ photos: newPhotos });
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [formData.photos, updateFormData]
  );

  const removePhoto = useCallback(
    (index: number) => {
      const newPhotos = formData.photos.filter((_, i) => i !== index);
      updateFormData({ photos: newPhotos });
    },
    [formData.photos, updateFormData]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Camera className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Fotos Ihres Wohnmobils
        </h2>
        <p className="text-muted-foreground">
          Fotos erhöhen Ihre Verkaufschancen um bis zu <strong>80%</strong> – Sie können sie aber auch später nachreichen
        </p>
      </div>

      {/* FOMO-Hinweis */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <p className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            Inserate mit <strong>mindestens 5 Fotos</strong> erhalten durchschnittlich <strong>3x mehr Anfragen</strong> von Händlern.
          </span>
        </p>
      </div>

      {!skipPhotos && (
        <>
          {/* Upload-Bereich */}
          <Card className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors">
            <label
              htmlFor="photo-upload"
              className="flex flex-col items-center justify-center py-6 md:py-10 px-4 cursor-pointer"
            >
              <Upload className="w-10 h-10 text-muted-foreground mb-3" />
              <span className="text-base font-medium text-foreground mb-1">
                Fotos hochladen
              </span>
              <span className="text-sm text-muted-foreground text-center">
                Klicken oder Dateien hierher ziehen (max. 30 Fotos, je max. 10 MB)
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

          {/* Foto-Vorschau */}
          {formData.photos.length > 0 && (
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
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1.5 md:p-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-md"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {index === 0 && (
                      <span className="absolute bottom-1 left-1 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded">
                        Titelbild
                      </span>
                    )}
                  </div>
                ))}

                {/* Upload-Platzhalter */}
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
        </>
      )}

      {/* Fotos später nachreichen - prominenter Button */}
      <Button
        type="button"
        variant={skipPhotos ? "default" : "outline"}
        className={`w-full py-6 text-base font-semibold transition-all ${
          skipPhotos
            ? "bg-primary text-white shadow-md"
            : "border-2 border-primary/30 hover:border-primary hover:bg-primary/5"
        }`}
        onClick={() => {
          const newSkip = !skipPhotos;
          setSkipPhotos(newSkip);
          if (newSkip) {
            updateFormData({ photos: [] });
          }
        }}
      >
        <Camera className="w-5 h-5 mr-2" />
        Fotos später nachreichen
      </Button>

      {/* Tipps */}
      <div className="bg-muted/50 rounded-lg p-4 border border-border">
        <p className="text-sm font-medium mb-2 flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          Tipps für gute Fotos:
        </p>
        <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
          <li>Außenansicht von allen 4 Seiten</li>
          <li>Innenraum: Wohnbereich, Küche, Bad</li>
          <li>Cockpit und Armaturenbrett</li>
          <li>Eventuelle Schäden oder Mängel</li>
        </ul>
      </div>
    </div>
  );
};
