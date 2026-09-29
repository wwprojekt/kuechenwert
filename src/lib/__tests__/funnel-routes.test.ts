import { describe, expect, it } from "vitest";
import { funnelForPath, isFunnelPath } from "../funnelRoutes";

describe("funnelForPath", () => {
  it("ordnet /formular und die Schritte Funnel A zu", () => {
    expect(funnelForPath("/formular")).toBe("a");
    expect(funnelForPath("/formular/")).toBe("a");
    expect(funnelForPath("/funnel/a")).toBe("a");
    expect(funnelForPath("/funnel/a/kontakt")).toBe("a");
  });

  it("kennt Funnel B und C", () => {
    expect(funnelForPath("/funnel/b")).toBe("b");
    expect(funnelForPath("/funnel/c")).toBe("c");
  });

  it("ignoriert andere Seiten", () => {
    for (const path of ["/", "/kuechenrechner", "/funnel/danke", "/funnel/bx", "/formulare", "/projekt/abc"]) {
      expect(funnelForPath(path)).toBeNull();
    }
  });
});

describe("isFunnelPath", () => {
  it("schließt die Danke-Seite in den Fokusmodus ein", () => {
    expect(isFunnelPath("/funnel/danke")).toBe(true);
    expect(isFunnelPath("/formular")).toBe(true);
    expect(isFunnelPath("/funnel/c")).toBe(true);
  });

  it("lässt die übrige Website unberührt", () => {
    expect(isFunnelPath("/")).toBe(false);
    expect(isFunnelPath("/kontakt")).toBe(false);
    expect(isFunnelPath("/dashboard")).toBe(false);
  });
});
