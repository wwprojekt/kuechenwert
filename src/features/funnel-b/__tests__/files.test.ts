import { describe, expect, it } from "vitest";
import { MAX_LEAD_FILE_BYTES, formatFileSize, leadFileCategoriesFor, leadFileLabel, leadFileProblem, leadFileType } from "../files";

const file = (name: string, type: string, size = 1000) => ({ name, type, size });

describe("leadFileType", () => {
  it("nimmt den Typ des Browsers", () => {
    expect(leadFileType(file("angebot.pdf", "application/pdf"))).toBe("application/pdf");
  });

  it("leitet leere Typen aus der Endung ab (HEIC auf manchen Geräten)", () => {
    expect(leadFileType(file("IMG_0001.HEIC", ""))).toBe("image/heic");
    expect(leadFileType(file("plan.jpeg", ""))).toBe("image/jpeg");
    expect(leadFileType(file("ohne-endung", ""))).toBe("");
  });

  it("vereinheitlicht image/jpg", () => {
    expect(leadFileType(file("foto.jpg", "image/jpg"))).toBe("image/jpeg");
  });
});

describe("leadFileProblem", () => {
  it("akzeptiert PDF als Angebot und Planung", () => {
    expect(leadFileProblem(file("angebot.pdf", "application/pdf"), "angebot")).toBeNull();
    expect(leadFileProblem(file("planung.pdf", "application/pdf"), "grundriss")).toBeNull();
  });

  it("lehnt PDF unter Fotos mit Hinweis auf die richtige Kategorie ab", () => {
    expect(leadFileProblem(file("planung.pdf", "application/pdf"), "kueche_bild")).toMatch(/Planung/);
  });

  it("lehnt andere Dateitypen ab", () => {
    expect(leadFileProblem(file("angebot.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), "angebot")).toMatch(/nur PDF oder Bilder/);
  });

  it("prüft die Größe", () => {
    expect(leadFileProblem(file("gross.pdf", "application/pdf", MAX_LEAD_FILE_BYTES + 1), "angebot")).toMatch(/maximal 20 MB/);
    expect(leadFileProblem(file("leer.pdf", "application/pdf", 0), "angebot")).toMatch(/leer/);
    expect(leadFileProblem(file("grenze.pdf", "application/pdf", MAX_LEAD_FILE_BYTES), "angebot")).toBeNull();
  });
});

describe("leadFileCategoriesFor", () => {
  it("fragt in Funnel B nach dem Angebot, sonst nach Grundriss und Raumfotos", () => {
    expect(leadFileCategoriesFor("b").map((c) => c.value)).toContain("angebot");
    for (const funnel of ["a", "c"]) {
      expect(leadFileCategoriesFor(funnel).map((c) => c.value)).toEqual(["grundriss", "kueche_bild"]);
    }
  });

  it("nimmt für Raumfotos keine PDFs an", () => {
    const photos = leadFileCategoriesFor("a").find((c) => c.value === "kueche_bild");
    expect(photos?.accept).toBe("image/*");
  });
});

describe("leadFileLabel", () => {
  it("zeigt lesbare Namen statt interner Kategorien", () => {
    expect(leadFileLabel("grundriss")).toBe("Planung / Grundriss");
    expect(leadFileLabel("kueche_bild")).toBe("Foto");
    expect(leadFileLabel("angebot")).toBe("Angebot");
    expect(leadFileLabel(null)).toBe("Datei");
  });
});

describe("formatFileSize", () => {
  it("rundet auf KB bzw. MB", () => {
    expect(formatFileSize(512)).toBe("1 KB");
    expect(formatFileSize(250 * 1024)).toBe("250 KB");
    expect(formatFileSize(3.25 * 1024 * 1024)).toBe("3,3 MB");
  });
});
