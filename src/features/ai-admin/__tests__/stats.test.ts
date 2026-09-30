import { describe, expect, it } from "vitest";
import { abVerdict, wilsonInterval } from "../stats";

describe("wilsonInterval", () => {
  it("ist bei wenigen Bewertungen breit und wird mit mehr Daten schmal", () => {
    const few = wilsonInterval(4, 5)!;
    const many = wilsonInterval(400, 500)!;
    expect(few[0]).toBeLessThan(0.45);
    expect(few[1]).toBeGreaterThan(0.95);
    expect(many[1] - many[0]).toBeLessThan(0.08);
    expect(many[0]).toBeLessThan(0.8);
    expect(many[1]).toBeGreaterThan(0.8);
  });

  it("bleibt in 0–1 und liefert ohne Daten nichts", () => {
    expect(wilsonInterval(0, 10)![0]).toBe(0);
    expect(wilsonInterval(10, 10)![1]).toBe(1);
    expect(wilsonInterval(0, 0)).toBeNull();
    expect(wilsonInterval(3, 2)).toBeNull();
  });
});

describe("abVerdict", () => {
  it("erklärt erst einen Sieger, wenn sich die Spannen nicht überlappen", () => {
    expect(abVerdict({ up: 7, rated: 10 }, { up: 5, rated: 10 })).toBe("open");
    expect(abVerdict({ up: 150, rated: 300 }, { up: 240, rated: 300 })).toBe("challenger");
    expect(abVerdict({ up: 240, rated: 300 }, { up: 150, rated: 300 })).toBe("control");
    expect(abVerdict(null, { up: 5, rated: 10 })).toBe("open");
  });
});
