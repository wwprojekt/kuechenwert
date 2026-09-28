import { describe, expect, it } from "vitest";
import { defaultConfig, defaultRoom } from "../core";
import { plannerRenderKey } from "../render-key";

describe("plannerRenderKey", () => {
  const config = defaultConfig();
  const room = defaultRoom("l");

  it("bleibt gleich, wenn nur Hinweise für die Studios geändert werden", () => {
    const key = plannerRenderKey(config, room, "s/photos/a.jpg");
    expect(plannerRenderKey({ ...config, wishes: "Heizkörper bleibt" }, { ...room, notes: "Wasser an Wand B" }, "s/photos/a.jpg")).toBe(key);
  });

  it("ändert sich mit Stil, Maßen oder Foto", () => {
    const key = plannerRenderKey(config, room, "s/photos/a.jpg");
    expect(plannerRenderKey({ ...config, style: "landhaus" }, room, "s/photos/a.jpg")).not.toBe(key);
    expect(plannerRenderKey(config, { ...room, walls: { ...room.walls, a: 420 } }, "s/photos/a.jpg")).not.toBe(key);
    expect(plannerRenderKey(config, room, "s/photos/b.jpg")).not.toBe(key);
    expect(plannerRenderKey(config, room, null)).not.toBe(key);
  });

  it("hängt nicht von der Reihenfolge der Felder ab", () => {
    const reordered = Object.fromEntries(Object.entries(config).reverse()) as typeof config;
    expect(plannerRenderKey(reordered, room, null)).toBe(plannerRenderKey(config, room, null));
  });
});
