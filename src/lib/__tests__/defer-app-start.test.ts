import { describe, expect, it } from "vitest";
import { deferAppStart } from "../../../scripts/defer-app-start.mjs";

const BOOT = "/js/app-boot.js?v=abc1234567";

// Aufbau wie von scripts/prerender.mjs aus Chrome serialisiert.
const page = (extraHead = "") => `<!doctype html>
<html lang="de"><head>
<script type="module" crossorigin="" src="/assets/index-A1.js"></script>
<link rel="modulepreload" crossorigin="" href="/assets/vendor-react-B2.js">
<link rel="modulepreload" crossorigin="" href="/assets/vendor-ui-C3.js">
<link rel="stylesheet" crossorigin="" href="/assets/index-D4.css">
<link rel="preload" href="/assets/fira-sans-latin-800-normal-E5.woff2" as="font" type="font/woff2" crossorigin="">
<link rel="modulepreload" as="script" crossorigin="" href="/assets/FormularLanding-F6.js">
<link rel="modulepreload" as="script" crossorigin="" href="/assets/vendor-ui-C3.js">
${extraHead}</head>
<body class="notranslate">
<div id="root"><div data-kw-route="true" class="contents"><h1>Küchenangebote</h1></div></div>
<script src="/js/consent-bootstrap.js?v=1111111111"></script>
<script src="/js/tracking-loader.js?v=2222222222"></script>
</body></html>
`;

describe("deferAppStart", () => {
  it("ersetzt App-Bundle und modulepreload-Links durch das Startskript am Ende von body", () => {
    const html = deferAppStart(page(), BOOT);

    expect(html).not.toContain('type="module"');
    expect(html).not.toContain("modulepreload");
    expect(html).toContain('<script src="/js/app-boot.js?v=abc1234567" data-entry="/assets/index-A1.js" ' +
      'data-preload="/assets/vendor-react-B2.js /assets/vendor-ui-C3.js /assets/FormularLanding-F6.js" defer></script>');
    expect(html.indexOf("app-boot.js")).toBeGreaterThan(html.indexOf("tracking-loader.js"));
    expect(html.indexOf("app-boot.js")).toBeLessThan(html.indexOf("</body>"));
  });

  it("lässt CSS, Schrift-Preloads, Inhalt und die übrigen Skripte unverändert", () => {
    const html = deferAppStart(page(), BOOT);

    expect(html).toContain('<link rel="stylesheet" crossorigin="" href="/assets/index-D4.css">');
    expect(html).toContain('<link rel="preload" href="/assets/fira-sans-latin-800-normal-E5.woff2" as="font"');
    expect(html).toContain("<h1>Küchenangebote</h1>");
    expect(html).toContain('<script src="/js/consent-bootstrap.js?v=1111111111"></script>');
    expect(html).toContain('<script src="/js/tracking-loader.js?v=2222222222"></script>');
  });

  it("bricht ab, wenn das App-Bundle fehlt oder doppelt ist", () => {
    const withoutEntry = page().replace(/<script type="module"[^>]*><\/script>/, "");
    expect(() => deferAppStart(withoutEntry, BOOT)).toThrow("0×");
    const doubled = page('<script type="module" crossorigin="" src="/assets/other-G7.js"></script>');
    expect(() => deferAppStart(doubled, BOOT)).toThrow("2×");
  });
});
