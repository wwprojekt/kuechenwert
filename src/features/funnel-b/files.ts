/**
 * Unterlagen zu einer Anfrage: Kategorien, Grenzen und Prüfung im Browser.
 * Funnel B fragt zuerst nach der Planung aus dem Studio (ein schriftliches
 * Angebot geben die meisten Studios nicht mit), Anfrage und Planer reichen
 * Grundriss und Raumfotos auf der Projektseite nach. Spiegelt
 * supabase/functions/_shared/lead-files.ts; Grenzen dort und hier gemeinsam ändern.
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
    value: "grundriss",
    label: "Planung",
    description: "Grundriss, Ansichten, Geräteliste – alles, was Ihnen das Studio mitgegeben hat.",
    accept: "application/pdf,image/*",
  },
  {
    value: "angebot",
    label: "Angebot (falls vorhanden)",
    description: "Schriftliches Angebot mit Positionen und Preisen.",
    accept: "application/pdf,image/*",
  },
  {
    value: "kueche_bild",
    label: "Fotos",
    description: "Fotos vom Raum oder einer Musterküche.",
    accept: "image/*",
  },
];

/** Anfrage (A) und Planer (C): Raum statt Angebot. */
export const ROOM_FILE_CATEGORIES: LeadFileCategoryOption[] = [
  {
    value: "grundriss",
    label: "Grundriss oder Bauplan",
    description: "Maßskizze, Bauplan oder Grundriss vom Architekten.",
    accept: "application/pdf,image/*",
  },
  {
    value: "kueche_bild",
    label: "Fotos vom Raum",
    description: "Die Wände, an die die Küche soll – bei Tageslicht und ohne Personen.",
    accept: "image/*",
  },
];

export function leadFileCategoriesFor(funnelType: string): LeadFileCategoryOption[] {
  return funnelType === "b" ? LEAD_FILE_CATEGORIES : ROOM_FILE_CATEGORIES;
}

/** Funnel B: Planung oder Angebot aus dem Studio, im Unterschied zu Fotos. */
export function isStudioPlanningFile(category: string): boolean {
  return category === "grundriss" || category === "angebot";
}

const CATEGORY_LABELS: Record<string, string> = {
  angebot: "Angebot",
  grundriss: "Planung / Grundriss",
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
    return `„${file.name}“ ist ein PDF – hier bitte nur Fotos, PDFs gehören zu Planung bzw. Grundriss.`;
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
