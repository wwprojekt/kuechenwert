import { supabase } from "@/integrations/supabase/client";
import { leadFileType, type LeadFileCategory, type PendingLeadFile } from "./files";

export interface UploadTarget {
  index: number;
  path: string;
  token: string;
}

export interface UploadedLeadFile {
  path: string;
  category: LeadFileCategory;
  name: string;
  type: string;
  size: number;
}

/** Ankündigung für kw-lead-b bzw. kw-project; die Function stellt dafür signierte Upload-URLs aus. */
export function announceFiles(files: PendingLeadFile[]) {
  return files.map(({ category, file }) => ({
    category,
    name: file.name,
    type: leadFileType(file) || "application/octet-stream",
    size: file.size,
  }));
}

/**
 * Lädt die Dateien nacheinander über die signierten URLs in den Bucket
 * lead-files. Liefert die erfolgreich hochgeladenen; `onProgress` meldet
 * die Zahl der bearbeiteten Dateien.
 */
export async function uploadToTargets(
  files: PendingLeadFile[],
  targets: UploadTarget[],
  onProgress?: (done: number, total: number) => void,
): Promise<UploadedLeadFile[]> {
  const uploaded: UploadedLeadFile[] = [];
  let done = 0;
  for (const target of targets) {
    const item = files[target.index];
    if (!item) continue;
    const type = leadFileType(item.file) || "application/octet-stream";
    const { error } = await supabase.storage.from("lead-files").uploadToSignedUrl(target.path, target.token, item.file, {
      contentType: type,
      cacheControl: "31536000, immutable",
    });
    done += 1;
    onProgress?.(done, targets.length);
    if (error) {
      console.error("Lead file upload failed", error);
      continue;
    }
    uploaded.push({ path: target.path, category: item.category, name: item.file.name, type, size: item.file.size });
  }
  return uploaded;
}
