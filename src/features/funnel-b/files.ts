/**
 * Unterlagen zu einer Anfrage „Studio-Preis unterbieten“: Kategorien, Grenzen
 * und Prüfung im Browser. Spiegelt supabase/functions/_shared/lead-files.ts;
 * Grenzen dort und hier gemeinsam ändern.
 */

/** Interne Kategorien in lead_files; „grundriss“ steht für die gesamte Planung. */
export type LeadFileCategory = "angebot" | "grundriss" | "kueche_bild";

export interface PendingLeadFile {
  id: string;
  category: LeadFileCategory;
  file: File;
}

export interface LeadFileCategoryOption {
  value: LeadFileCategory;
  label: string;
  description: string;
  accept: string;
}

export const LEAD_FILE_CATEGORIES: LeadFileCategoryOption[] = [
  {
    value: "angebot",
    label: "Schriftliches Angebot",
    description: "PDF oder Fotos der Seiten – am besten mit Positionsliste und Preisen.",
    accept: "application/pdf,image/*",
  },
  {
    value: "grundriss",
    label: "Planung",
    description: "Grundriss, Ansichten oder Perspektiven aus dem Küchenstudio.",
    accept: "application/pdf,image/*",
  },
  {
    value: "kueche_bild",
    label: "Fotos",
    description: "Fotos der Planung, des Raums oder einer Musterküche.",
    accept: "image/*",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  angebot: "Angebot",
  grundriss: "Planung",
  kueche_bild: "Foto",
  rendering: "Visualisierung",
  sonstiges: "Sonstiges",
};

export function leadFileLabel(category: string | null | undefined): string {
  return (category && CATEGORY_LABELS[category]) || "Datei";
}

export const MAX_LEAD_FILE_BYTES = 20 * 1024 * 1024;
/** Pro Anfrage bzw. pro Upload-Vorgang über den Projektlink. */
export const MAX_LEAD_FILES = 10;
/** Insgesamt pro Projekt, auch mit nachgereichten Unterlagen. */
export const MAX_LEAD_FILES_PER_PROJECT = 20;

const TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};
const ACCEPTED_TYPES = new Set(Object.values(TYPE_BY_EXTENSION));
const EXTENSION_BY_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

/** Dateiendung für den Speicherpfad; null bei nicht erlaubtem Typ. */
export function leadFileExtension(type: string): string | null {
  return EXTENSION_BY_TYPE[type] ?? null;
}

/** MIME-Typ der Datei; manche Browser liefern für HEIC einen leeren Typ. */
export function leadFileType(file: Pick<File, "name" | "type">): string {
  const type = file.type.toLowerCase();
  if (type) return type === "image/jpg" ? "image/jpeg" : type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TYPE_BY_EXTENSION[extension] ?? "";
}

/** Fehlermeldung für eine ausgewählte Datei oder null, wenn sie passt. */
export function leadFileProblem(file: Pick<File, "name" | "type" | "size">, category: LeadFileCategory): string | null {
  const type = leadFileType(file);
  if (!ACCEPTED_TYPES.has(type)) return `„${file.name}“: Bitte nur PDF oder Bilder (JPG, PNG, WebP, HEIC) hochladen.`;
  if (category === "kueche_bild" && type === "application/pdf") {
    return `„${file.name}“ ist ein PDF – bitte unter „Planung“ oder „Schriftliches Angebot“ hochladen.`;
  }
  if (file.size <= 0) return `„${file.name}“ ist leer.`;
  if (file.size > MAX_LEAD_FILE_BYTES) {
    return `„${file.name}“ ist ${formatFileSize(file.size)} groß – maximal ${MAX_LEAD_FILE_BYTES / 1024 / 1024} MB pro Datei.`;
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}
