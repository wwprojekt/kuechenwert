import { describe, expect, it } from "vitest";
import { FORM_OPTIONS } from "../../catalog";
import { funnelEntryUrl } from "../entry";
import { LANDING_FAQ_QUESTIONS, landingFaqItems } from "../faq";

describe("funnelEntryUrl", () => {
  it("startet mit gewählter Form bei Schritt 2 und reicht Tracking-Parameter durch", () => {
    expect(funnelEntryUrl("?utm_source=google&utm_campaign=kueche&gclid=abc", "l")).toBe(
      "/funnel/a/raum?form=l&utm_source=google&utm_campaign=kueche&gclid=abc",
    );
    expect(funnelEntryUrl("?msclkid=m1&fbclid=f1&plz=30159", "insel")).toBe("/funnel/a/raum?form=insel&msclkid=m1&fbclid=f1&plz=30159");
  });

  it("ersetzt ein ?form= aus der Landing-URL", () => {
    expect(funnelEntryUrl("?form=u&gbraid=g1", "zeile")).toBe("/funnel/a/raum?form=zeile&gbraid=g1");
  });

  it("startet ohne Auswahl beim ersten Schritt", () => {
    expect(funnelEntryUrl("")).toBe("/funnel/a/kuechenform");
    expect(funnelEntryUrl("?form=u&wbraid=w1")).toBe("/funnel/a/kuechenform?wbraid=w1");
  });

  it("baut für jede Küchenform einen Link", () => {
    for (const option of FORM_OPTIONS) {
      expect(funnelEntryUrl("", option.id)).toBe(`/funnel/a/raum?form=${option.id}`);
    }
  });
});

describe("landingFaqItems", () => {
  it("findet alle ausgewählten Fragen in der FAQ", () => {
    const items = landingFaqItems();
    expect(items.map((f) => f.question)).toEqual(LANDING_FAQ_QUESTIONS);
    expect(items.every((f) => f.answer.length > 0)).toBe(true);
  });
});
