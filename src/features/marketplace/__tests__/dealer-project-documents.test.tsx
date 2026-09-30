import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DealerProjectDocuments } from "../components/DealerProjectDocuments";
import type { DealerProjectMedia } from "../dealer-api";

const doc = (path: string, category: string, type: string, name: string | null = null): DealerProjectMedia => ({
  bucket: "lead-files",
  path,
  kind: "document",
  category,
  type,
  name,
  released: true,
});

describe("DealerProjectDocuments", () => {
  it("zeigt vor dem Kontaktkauf neutrale Titel statt Dateinamen", () => {
    render(
      <DealerProjectDocuments
        documents={[doc("l/angebot-1.pdf", "angebot", "application/pdf"), doc("l/grundriss-1.pdf", "grundriss", "application/pdf"), doc("l/grundriss-2.png", "grundriss", "image/png")]}
        urls={{ "l/angebot-1.pdf": "https://example.test/a", "l/grundriss-2.png": "https://example.test/p2" }}
        loading={false}
        full={false}
      />,
    );
    expect(screen.getByText("Angebot 1")).toBeInTheDocument();
    expect(screen.getByText("Planung / Grundriss 1")).toBeInTheDocument();
    expect(screen.getByText("Planung / Grundriss 2")).toBeInTheDocument();
    expect(screen.getByText(/ohne Namen und Kontaktdaten freigegeben/)).toBeInTheDocument();
    expect(screen.getByText("nicht verfügbar")).toBeInTheDocument();
    expect(screen.getByAltText("Planung / Grundriss 2")).toHaveAttribute("src", "https://example.test/p2");
  });

  it("zeigt nach dem Kontaktkauf die Dateinamen", () => {
    render(
      <DealerProjectDocuments
        documents={[doc("l/angebot-1.pdf", "angebot", "application/pdf", "Angebot_Mueller.pdf")]}
        urls={{}}
        loading={true}
        full={true}
      />,
    );
    expect(screen.getByText("Angebot_Mueller.pdf")).toBeInTheDocument();
    expect(screen.getByText(/auch das Originalangebot/)).toBeInTheDocument();
    expect(screen.getByText("wird geladen …")).toBeInTheDocument();
  });

  it("rendert nichts ohne Unterlagen", () => {
    const { container } = render(<DealerProjectDocuments documents={[]} urls={{}} loading={false} full={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
