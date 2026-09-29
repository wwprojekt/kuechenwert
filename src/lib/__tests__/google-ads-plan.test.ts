import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  IMAGE_MAX_BYTES,
  KW_ADS_PLAN,
  REMARKETING_PREFIX,
  THANK_YOU_PATH,
  imageFits,
  negativeBlocks,
  validatePlan,
} from "../../../supabase/functions/_shared/google-ads-plan.ts";
import { imageInfo } from "../../../supabase/functions/_shared/image-size.ts";

const ADS_DIR = resolve(process.cwd(), "public/ads");

describe("Google-Ads-Plan", () => {
  it("hält die Google-Vorgaben ein und hat keine Keyword-Konflikte", () => {
    expect(validatePlan(KW_ADS_PLAN)).toEqual([]);
  });

  it("wertet Ausschlüsse wie Google aus", () => {
    expect(negativeBlocks({ text: "ikea", match: "BROAD" }, "ikea küche planen")).toBe(true);
    expect(negativeBlocks({ text: "in der nähe", match: "PHRASE" }, "küchenstudio in der nähe")).toBe(true);
    expect(negativeBlocks({ text: "in der nähe", match: "PHRASE" }, "nähe der küche")).toBe(false);
    expect(negativeBlocks({ text: "kosten", match: "BROAD" }, "küchenplaner kostenlos")).toBe(false);
    expect(negativeBlocks({ text: "küche", match: "EXACT" }, "küche kaufen")).toBe(false);
  });

  it("meldet zu lange Texte, blockierte und doppelte Keywords", () => {
    const broken = structuredClone(KW_ADS_PLAN);
    broken.campaigns[0].adGroups[0].ad.headlines[0] = "Diese Überschrift ist viel zu lang für Google";
    broken.campaigns[0].adGroups[0].keywords.push({ text: "ikea küche kaufen", match: "PHRASE" });
    broken.campaigns[2].adGroups[0].keywords.push({ text: "küche kaufen", match: "EXACT" });
    const errors = validatePlan(broken);
    expect(errors.some((e) => e.includes("Zeichen"))).toBe(true);
    expect(errors.some((e) => e.includes("blockiert"))).toBe(true);
    expect(errors.some((e) => e.includes("schon in"))).toBe(true);
  });

  it("hat für jedes Bild eine Datei im geforderten Format und keine verwaisten Dateien", () => {
    for (const image of KW_ADS_PLAN.images) {
      const bytes = new Uint8Array(readFileSync(resolve(ADS_DIR, image.file)));
      const info = imageInfo(bytes);
      expect(info, image.file).not.toBeNull();
      expect(info!.mime, image.file).toBe(image.file.endsWith(".png") ? "image/png" : "image/jpeg");
      expect(imageFits(image.format, info!.width, info!.height), `${image.file}: ${info!.width}×${info!.height}`).toBe(true);
      expect(bytes.length, image.file).toBeLessThanOrEqual(IMAGE_MAX_BYTES);
    }
    expect(readdirSync(ADS_DIR).sort()).toEqual(KW_ADS_PLAN.images.map((i) => i.file).sort());
  });

  it("liest Maße aus JPEG- und PNG-Headern", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 4, 176, 0, 0, 2, 116]);
    expect(imageInfo(png)).toEqual({ mime: "image/png", width: 1200, height: 628 });
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 1, 44, 1, 44, 3, 0, 0]);
    expect(imageInfo(jpeg)).toEqual({ mime: "image/jpeg", width: 300, height: 300 });
    expect(imageInfo(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(imageFits("landscape", 1200, 628)).toBe(true);
    expect(imageFits("square", 1200, 628)).toBe(false);
    expect(imageFits("logo", 100, 100)).toBe(false);
  });

  it("führt nur auf Seiten, die nginx öffentlich ausliefert", () => {
    const conf = readFileSync(resolve(process.cwd(), "docker/default.conf"), "utf8");
    const route = conf.match(/location ~ \^\/\(\?:(kuechenstudios\|[^$]+)\)\$ \{/);
    expect(route).not.toBeNull();
    const publicRoute = new RegExp(`^/(?:${route![1]})$`);
    for (const path of [...KW_ADS_PLAN.allowedPaths.filter((p) => p !== "/"), THANK_YOU_PATH]) {
      expect(publicRoute.test(path), path).toBe(true);
    }
  });

  it("prüft Remarketing-Listen auf Präfix, Mitgliedsdauer und vorhandene Seiten", () => {
    const broken = structuredClone(KW_ADS_PLAN);
    broken.remarketingLists.push(
      { name: "Fremde Liste", description: "", lifespanDays: 30, visited: ["kuechenwert24.de/formular"], notVisited: [] },
      { name: `${REMARKETING_PREFIX}Zu lang`, description: "", lifespanDays: 600, visited: ["kuechenwert24.de/gibtsnicht"], notVisited: [] },
      { name: `${REMARKETING_PREFIX}Fremde Domain`, description: "", lifespanDays: 30, visited: ["example.com/formular"], notVisited: [] },
    );
    const errors = validatePlan(broken);
    expect(errors.some((e) => e.includes("Fremde Liste") && e.includes("ohne"))).toBe(true);
    expect(errors.some((e) => e.includes("600"))).toBe(true);
    expect(errors.some((e) => e.includes("/gibtsnicht"))).toBe(true);
    expect(errors.some((e) => e.includes("example.com"))).toBe(true);
  });
});
