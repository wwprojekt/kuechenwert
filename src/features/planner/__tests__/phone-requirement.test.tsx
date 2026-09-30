import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequestOffersDialog } from "../components/RequestOffersDialog";
import { LeadContactStep, PHONE_ERROR, phoneNeeded, validateLead, type LeadContact } from "../steps/LeadSteps";

const contact = (patch: Partial<LeadContact> = {}): LeadContact => ({
  first_name: "Maria",
  last_name: "Muster",
  email: "maria@beispiel.de",
  phone: "",
  contact_by_phone: false,
  ...patch,
});

const noop = () => undefined;

const renderContactStep = (value: LeadContact, wantsOffers: boolean) =>
  render(
    <LeadContactStep
      contact={value}
      errors={{}}
      wantsOffers={wantsOffers}
      onChange={noop}
      onSubmit={noop}
      onChangeChoice={noop}
      honeypot=""
      onHoneypot={noop}
      turnstileRef={noop}
    />,
  );

describe("Telefonnummer im Planer", () => {
  it("ist mit Angeboten Pflicht, ohne Angebote nur für den gewünschten Beratungsanruf", () => {
    expect(phoneNeeded(contact(), true)).toBe(true);
    expect(phoneNeeded(contact(), false)).toBe(false);
    expect(phoneNeeded(contact({ contact_by_phone: true }), false)).toBe(true);

    expect(validateLead(contact(), true).phone).toBe(PHONE_ERROR);
    expect(validateLead(contact(), false)).toEqual({});
    expect(validateLead(contact({ phone: "0511 123456" }), true)).toEqual({});
    expect(validateLead(contact({ phone: "123" }), true).phone).toBe(PHONE_ERROR);
  });

  it("fragt ohne Angebote erst nach dem Beratungswunsch nach der Nummer", () => {
    const { unmount } = renderContactStep(contact(), false);
    expect(screen.queryByLabelText(/Telefon/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/kostenlose Beratung/)).toBeInTheDocument();
    unmount();

    renderContactStep(contact({ contact_by_phone: true }), false);
    expect(screen.getByLabelText(/Telefon/)).toBeRequired();
  });

  it("fragt mit Angeboten immer nach der Nummer", () => {
    renderContactStep(contact(), true);
    expect(screen.getByLabelText(/Telefon/)).toBeRequired();
    expect(screen.getByText("Für Rückfragen der Studios zu Ihrem Angebot")).toBeInTheDocument();
  });

  it("verlangt beim nachträglichen Anfordern eine Nummer, wenn keine gespeichert ist", () => {
    const onConfirm = vi.fn();
    render(<RequestOffersDialog open onOpenChange={noop} busy={false} error={null} needsPhone onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Angebote anfordern" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(PHONE_ERROR)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Telefon/), { target: { value: " 0511 123456 " } });
    fireEvent.click(screen.getByRole("button", { name: "Angebote anfordern" }));
    expect(onConfirm).toHaveBeenCalledWith({ timeframeMonths: null, contactByPhone: false, phone: "0511 123456" });
  });

  it("fragt nicht erneut, wenn die Nummer schon gespeichert ist", () => {
    const onConfirm = vi.fn();
    render(<RequestOffersDialog open onOpenChange={noop} busy={false} error={null} onConfirm={onConfirm} />);
    expect(screen.queryByLabelText(/Telefon/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Angebote anfordern" }));
    expect(onConfirm).toHaveBeenCalledWith({ timeframeMonths: null, contactByPhone: false });
  });
});
