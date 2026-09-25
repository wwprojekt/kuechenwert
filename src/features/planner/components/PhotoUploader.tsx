import { Camera, Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import type { PlannerPhoto } from "../api";

export function PhotoUploader({
  photos,
  selectedPath,
  onSelect,
  onUpload,
  onRemove,
  maxPhotos = 3,
}: {
  photos: PlannerPhoto[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onUpload: (file: File) => Promise<void>;
  onRemove: (path: string) => Promise<void>;
  maxPhotos?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const full = photos.length >= maxPhotos;

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || busy || full) return;
    setBusy(true);
    try {
      await onUpload(file);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragging(false);
    void handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <div role="radiogroup" aria-label="Foto für die Visualisierung" className="grid grid-cols-3 gap-3">
          {photos.map((photo) => {
            const selected = photo.path === selectedPath;
            return (
              <div key={photo.path} className="relative">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSelect(photo.path)}
                  className={cn(
                    "block aspect-[4/3] w-full overflow-hidden rounded-xl border-2 bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-primary/40",
                  )}
                >
                  {photo.url ? (
                    <img src={photo.url} alt="Ihr Raumfoto" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-muted-foreground">
                      <Camera className="h-6 w-6" />
                    </span>
                  )}
                  {selected && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                      <Check className="h-3 w-3" /> Wird genutzt
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setRemoving(photo.path);
                    try {
                      await onRemove(photo.path);
                    } finally {
                      setRemoving(null);
                    }
                  }}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                  aria-label="Foto entfernen"
                >
                  {removing === photo.path ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!full && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          disabled={busy}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            dragging ? "border-primary bg-primary/10" : "border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10",
          )}
        >
          {busy ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-md">
              <ImagePlus className="h-6 w-6" />
            </span>
          )}
          <span className="text-base font-semibold text-foreground">
            {busy ? "Foto wird hochgeladen …" : photos.length ? "Weiteres Foto hinzufügen" : "Foto Ihrer Küche hochladen"}
          </span>
          <span className="max-w-sm text-sm text-muted-foreground">
            Tippen, um ein Foto aufzunehmen oder auszuwählen – oder hierher ziehen. Am besten im Querformat aus der Tür fotografiert.
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </div>
  );
}
