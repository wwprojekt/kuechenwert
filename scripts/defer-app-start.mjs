/**
 * Vorgerenderte Seiten starten die App erst nach dem ersten Paint
 * (public/js/app-boot.js): App-Bundle und modulepreload-Links wandern aus dem
 * HTML in die data-Attribute des Startskripts am Ende von <body>.
 */

const ENTRY = /<script type="module" crossorigin(?:="")? src="(\/assets\/[^"]+\.js)"><\/script>\s*/g;
const MODULE_PRELOAD = /<link rel="modulepreload"[^>]*?\shref="(\/assets\/[^"]+\.js)"[^>]*>\s*/g;

/**
 * @param {string} html vorgerendertes Dokument
 * @param {string} bootSrc URL von app-boot.js inklusive ?v=<Hash>
 * @returns {string}
 */
export function deferAppStart(html, bootSrc) {
  const entries = [...html.matchAll(ENTRY)];
  if (entries.length !== 1) throw new Error(`App-Bundle ${entries.length}× im HTML, erwartet 1×`);
  if (!html.includes("</body>")) throw new Error("</body> fehlt");
  const preloads = [...new Set([...html.matchAll(MODULE_PRELOAD)].map((m) => m[1]))];
  const boot = `<script src="${bootSrc}" data-entry="${entries[0][1]}" data-preload="${preloads.join(" ")}" defer></script>`;
  return html.replace(ENTRY, "").replace(MODULE_PRELOAD, "").replace("</body>", `${boot}\n</body>`);
}
