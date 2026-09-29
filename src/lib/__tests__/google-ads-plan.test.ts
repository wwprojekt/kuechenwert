import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KW_ADS_PLAN,
  negativeBlocks,
  validatePlan,
} from "../../../supabase/functions/_shared/google-ads-plan.ts";

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

  it("führt nur auf Seiten, die nginx öffentlich ausliefert", () => {
    const conf = readFileSync(resolve(process.cwd(), "docker/default.conf"), "utf8");
    const route = conf.match(/location ~ \^\/\(\?:(kuechenstudios\|[^$]+)\)\$ \{/);
    expect(route).not.toBeNull();
    const publicRoute = new RegExp(`^/(?:${route![1]})$`);
    for (const path of KW_ADS_PLAN.allowedPaths.filter((p) => p !== "/")) {
      expect(publicRoute.test(path), path).toBe(true);
    }
  });
});
