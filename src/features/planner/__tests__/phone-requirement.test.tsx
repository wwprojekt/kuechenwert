import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FUNNEL_TERMS, TERMS_LABEL, TERMS_MISSING } from "../../../../supabase/functions/_shared/lead-terms.ts";
import { RequestOffersDialog } from "../components/RequestOffersDialog";
import { LeadContactStep, PHONE_ERROR, validateLead, type LeadContact } from "../steps/LeadSteps";

const contact = (patch: Partial<LeadContact> = {}): LeadContact => ({
  first_name: "Maria",
  last_name: "Muster",
  email: "maria@beispiel.de",
  phone: "0511 123456",
  accept_terms: true,
  ...patch,
});

const noop = () => undefined;

const renderContactStep = (value: LeadContact) =>
  render(
    <LeadContactStep contact={value} errors={{}} onChange={noop} onSubmit={noop} honeypot="" onHoneypot={noop} turnstileRef={noop} />,
  );

describe("Kontakt im Planer", () => {
  it("verlangt Telefonnummer und AGB-Bestätigung", () => {
    expect(validateLead(contact())).toEqual({});
    expect(validateLead(contact({ phone: "" })).phone).toBe(PHONE_ERROR);
    expect(validateLead(contact({ phone: "123" })).phone).toBe(PHONE_ERROR);
    expect(validateLead(contact({ accept_terms: false })).accept_terms).toBe(TERMS_MISSING);
  });

  it("zeigt Telefon als Pflichtfeld, den Hinweis zu den Angeboten und nur einen Haken – ohne Anruf-Haken", () => {
    const { container } = renderContactStep(contact({ phone: "", accept_terms: false }));
    expect(screen.getByLabelText(/Telefon/)).toBeRequired();
    expect(screen.getByText("Für Rückfragen der Studios zu Ihrem Angebot")).toBeInTheDocument();
    expect(screen.getByText(FUNNEL_TERMS.c.notice)).toBeInTheDocument();
    const boxes = container.querySelectorAll('input[type="checkbox"]');
    expect(boxes).toHaveLength(1);
    expect(boxes[0]!.closest("div")?.textContent).toBe(TERMS_LABEL);
    expect(screen.queryByText(/anrufen/)).not.toBeInTheDocument();
  });

  it("verlangt beim nachträglichen Anfordern eine Nummer, wenn keine gespeichert ist", () => {
    const onConfirm = vi.fn();
    render(<RequestOffersDialog open onOpenChange={noop} busy={false} error={null} needsPhone onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Angebote anfordern" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(PHONE_ERROR)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Telefon/), { target: { value: " 0511 123456 " } });
    fireEvent.click(screen.getByRole("button", { name: "Angebote anfordern" }));
    expect(onConfirm).toHaveBeenCalledWith({ timeframeMonths: null, phone: "0511 123456" });
  });

  it("fragt nicht erneut, wenn die Nummer schon gespeichert ist, und hat keinen Anruf-Haken", () => {
    const onConfirm = vi.fn();
    render(<RequestOffersDialog open onOpenChange={noop} busy={false} error={null} onConfirm={onConfirm} />);
    expect(screen.queryByLabelText(/Telefon/)).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Angebote anfordern" }));
    expect(onConfirm).toHaveBeenCalledWith({ timeframeMonths: null });
  });
});
