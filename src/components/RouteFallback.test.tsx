import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import RouteFallback from "./RouteFallback";
import { captureInitialRouteHtml, peekInitialRouteHtml, releaseInitialRouteHtml } from "@/lib/initialRouteHtml";

function prerenderedRoot(inner: string) {
  const root = document.createElement("div");
  root.innerHTML = inner;
  return root;
}

describe("RouteFallback", () => {
  afterEach(() => releaseInitialRouteHtml());

  it("zeigt beim ersten Laden das vorgerenderte Seiten-HTML und gibt es danach frei", () => {
    const html = captureInitialRouteHtml(
      prerenderedRoot('<div data-kw-route class="contents"><main><h1>Küchenangebote vergleichen</h1></main></div><a>WhatsApp</a>'),
    );
    expect(html).toBe("<main><h1>Küchenangebote vergleichen</h1></main>");

    const { unmount } = render(<RouteFallback />);
    expect(screen.getByRole("heading", { name: "Küchenangebote vergleichen" })).toBeInTheDocument();
    expect(screen.queryByText("WhatsApp")).not.toBeInTheDocument();

    unmount();
    expect(peekInitialRouteHtml()).toBeNull();
    const { container } = render(<RouteFallback />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("zeigt den Spinner bei der SPA-Shell oder alten Vorschau ohne Markierung", () => {
    expect(captureInitialRouteHtml(prerenderedRoot(""))).toBeNull();
    expect(captureInitialRouteHtml(prerenderedRoot("<main><h1>Alt</h1></main>"))).toBeNull();
    expect(captureInitialRouteHtml(prerenderedRoot('<div data-kw-route class="contents">  </div>'))).toBeNull();

    const { container } = render(<RouteFallback />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });
});
