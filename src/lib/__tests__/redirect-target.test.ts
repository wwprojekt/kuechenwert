import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "../redirectTarget";

describe("safeRedirectPath", () => {
  it.each(["/", "/dashboard", "/dashboard/projekte/abc-123", "/dashboard/projekte?tab=offen#neu", "/reset-password", "/%2F%2Ffremd.de"])(
    "lässt den eigenen Pfad %s durch",
    (path) => {
      expect(safeRedirectPath(path)).toBe(path);
    },
  );

  it.each([
    ["leer", ""],
    ["fehlt", null],
    ["undefiniert", undefined],
    ["relativ", "dashboard"],
    ["protokollrelativ", "//fremd.de"],
    ["protokollrelativ mit Pfad", "//fremd.de/dashboard"],
    ["Backslash nach dem Schrägstrich", "/\\fremd.de"],
    ["Backslash im Pfad", "/dashboard\\..\\x"],
    ["Schema https", "https://fremd.de"],
    ["Schema javascript", "javascript:alert(1)"],
    ["Tab", "/\t/fremd.de"],
    ["Zeilenumbruch", "/\n/fremd.de"],
    ["Leerzeichen davor", " /dashboard"],
    ["Steuerzeichen", "/\u0000/fremd.de"],
    ["DEL", "/\u007f/fremd.de"],
  ])("weist %s ab", (_name, value) => {
    expect(safeRedirectPath(value)).toBeNull();
  });
});
