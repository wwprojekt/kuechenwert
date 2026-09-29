import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PriceSummary } from "../components/PriceSummary";
import { KITCHEN_FORMS, defaultConfig, defaultRoom, estimateKitchenPrice } from "../core";
import { estimateNote, estimateVisible, roomWallIssues } from "../estimate-gate";

describe("roomWallIssues", () => {
  it("akzeptiert die vorbelegten Maße aller Küchenformen", () => {
    for (const form of KITCHEN_FORMS) expect(roomWallIssues(defaultRoom(form.id))).toEqual({});
  });

  it("meldet leere, zu kurze und zu lange Wände", () => {
    const room = { ...defaultRoom("u"), walls: { a: 0, b: 35, c: 1500 } };
    expect(roomWallIssues(room)).toEqual({ a: "Bitte Länge angeben", b: "Mindestens 60 cm", c: "Höchstens 1.200 cm" });
  });

  it("erlaubt eine leere optionale Wand, aber keine Stummel", () => {
    const insel = defaultRoom("insel");
    expect(roomWallIssues({ ...insel, walls: { ...insel.walls, b: 0 } })).toEqual({});
    expect(roomWallIssues({ ...insel, walls: { ...insel.walls, b: 20 } })).toEqual({ b: "0 oder mindestens 60 cm" });
  });
});

describe("Sichtbarkeit und Hinweis der Schätzung", () => {
  it("zeigt im Raum-Schritt noch keine Schätzung", () => {
    expect(estimateVisible(0)).toBe(false);
    expect(estimateVisible(1)).toBe(true);
  });

  it("nennt die noch offenen preisrelevanten Schritte", () => {
    expect(estimateNote(1)).toMatch(/Arbeitsplatte und Geräten/);
    expect(estimateNote(2)).toMatch(/Geräten und Extras/);
    expect(estimateNote(3)).toBeNull();
    expect(estimateNote(5)).toBeNull();
  });
});

describe("PriceSummary", () => {
  it("zeigt ohne Schätzung keine Beträge, sondern wann sie kommt", () => {
    const { container } = render(<PriceSummary estimate={null} />);
    expect(screen.getByText("Folgt nach diesem Schritt")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/€/);
    expect(screen.queryByText("Wie setzt sich der Preis zusammen?")).not.toBeInTheDocument();
  });

  it("zeigt die Schätzung mit Hinweis", () => {
    const estimate = estimateKitchenPrice(defaultConfig(), defaultRoom("l"));
    render(<PriceSummary estimate={estimate} note="Wird mit Geräten und Extras noch genauer." />);
    expect(screen.getByText("Geschätzter Marktpreis")).toBeInTheDocument();
    expect(screen.getByText("Wird mit Geräten und Extras noch genauer.")).toBeInTheDocument();
    expect(screen.getByText("Wie setzt sich der Preis zusammen?")).toBeInTheDocument();
  });
});
