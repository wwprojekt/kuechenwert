import { describe, expect, it } from "vitest";
import { canReportCancellation, contractDeviation, dealerNextSteps, orderMilestones, type Order } from "../order";

const NOW = new Date("2026-10-01T12:00:00Z");

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    auction_id: "a1",
    status: "awarded",
    offer_price_eur: 20000,
    contract_value_eur: null,
    contacted_at: null,
    measurement_at: null,
    contract_signed_at: null,
    installation_at: null,
    completed_at: null,
    consumer_confirmed_at: null,
    cancelled_at: null,
    cancel_reason: null,
    problem_reported_at: null,
    created_at: "2026-09-20T10:00:00Z",
    updated_at: "2026-09-20T10:00:00Z",
    can_confirm: false,
    events: [],
    ...overrides,
  };
}

const states = (o: Order) => Object.fromEntries(orderMilestones(o, NOW).map((m) => [m.key, m.state]));

describe("orderMilestones", () => {
  it("zeigt nach dem Zuschlag nur die Beauftragung als erledigt", () => {
    expect(states(order())).toEqual({ awarded: "done", measurement: "open", contract: "open", installation: "open", completed: "open" });
  });

  it("unterscheidet geplantes und vergangenes Aufmaß", () => {
    expect(states(order({ status: "measurement_scheduled", measurement_at: "2026-10-05T08:00:00Z" })).measurement).toBe("scheduled");
    expect(states(order({ status: "measurement_scheduled", measurement_at: "2026-09-28T08:00:00Z" })).measurement).toBe("done");
  });

  it("wertet das Aufmaß ab Kaufvertrag als erledigt, auch ohne Termin", () => {
    const s = states(order({ status: "contract_signed", contract_signed_at: "2026-09-30T10:00:00Z", contract_value_eur: 21000 }));
    expect(s.measurement).toBe("done");
    expect(s.contract).toBe("done");
    expect(s.installation).toBe("open");
  });

  it("hält die Montage bis zur Fertigmeldung als geplant", () => {
    const s = states(order({ status: "installation_scheduled", contract_signed_at: "2026-09-30T10:00:00Z", installation_at: "2026-09-29T00:00:00Z" }));
    expect(s.installation).toBe("scheduled");
    expect(s.completed).toBe("open");
  });

  it("nutzt das Bestätigungsdatum der Kundin als Fertig-Datum", () => {
    const m = orderMilestones(order({ status: "completed", completed_at: "2026-09-30T10:00:00Z", consumer_confirmed_at: "2026-10-01T09:00:00Z" }), NOW);
    const done = m.find((x) => x.key === "completed");
    expect(done?.state).toBe("done");
    expect(done?.date).toBe("2026-10-01T09:00:00Z");
  });
});

describe("dealerNextSteps", () => {
  it("empfiehlt je Status die passende nächste Etappe zuerst", () => {
    expect(dealerNextSteps(order())[0]).toBe("measurement");
    expect(dealerNextSteps(order({ status: "contacted" }))).toEqual(["measurement"]);
    expect(dealerNextSteps(order({ status: "measurement_scheduled" }))[0]).toBe("contract");
    expect(dealerNextSteps(order({ status: "contract_signed" }))).toEqual(["installation"]);
    expect(dealerNextSteps(order({ status: "installation_scheduled" }))[0]).toBe("completed");
  });

  it("bietet nach Abschluss, Absage oder Bestätigung nichts mehr an", () => {
    expect(dealerNextSteps(order({ status: "completed" }))).toEqual([]);
    expect(dealerNextSteps(order({ status: "cancelled" }))).toEqual([]);
    expect(dealerNextSteps(order({ status: "installation_scheduled", consumer_confirmed_at: "2026-10-01T09:00:00Z" }))).toEqual([]);
  });
});

describe("canReportCancellation", () => {
  it("erlaubt die Absage bis zur Bestätigung", () => {
    expect(canReportCancellation(order({ status: "contract_signed" }))).toBe(true);
    expect(canReportCancellation(order({ status: "cancelled" }))).toBe(false);
    expect(canReportCancellation(order({ status: "completed", consumer_confirmed_at: "2026-10-01T09:00:00Z" }))).toBe(false);
  });
});

describe("contractDeviation", () => {
  it("berechnet die relative Abweichung vom Angebot", () => {
    expect(contractDeviation({ offer_price_eur: 20000, contract_value_eur: 22000 })).toBeCloseTo(0.1);
    expect(contractDeviation({ offer_price_eur: 20000, contract_value_eur: 19000 })).toBeCloseTo(-0.05);
    expect(contractDeviation({ offer_price_eur: 20000, contract_value_eur: null })).toBeNull();
  });
});
