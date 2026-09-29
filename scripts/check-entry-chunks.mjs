/**
 * Nach `vite build`: Admin-Bibliotheken dürfen nicht statisch am Einstieg
 * hängen, sonst lädt jede öffentliche Seite sie mit (siehe vendor-utils in
 * vite.config.ts). Folgt den statischen Imports ab dem Modul-Skript in
 * dist/index.html; dynamische import()-Aufrufe zählen nicht.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const DIST = path.resolve("dist");
const FORBIDDEN = ["vendor-recharts", "vendor-editor"];

const html = readFileSync(path.join(DIST, "index.html"), "utf8");
const entry = html.match(/<script type="module"[^>]*src="\/assets\/([^"]+\.js)"/)?.[1];
if (!entry) {
  console.error("check-entry-chunks: Einstiegs-Skript in dist/index.html nicht gefunden");
  process.exit(1);
}

const staticImports = (code) =>
  [...code.matchAll(/(?:\bfrom|\bimport)\s*"\.\/([\w.-]+\.js)"/g)].map((m) => m[1]);

const seen = new Map([[entry, null]]);
const queue = [entry];
while (queue.length) {
  const file = queue.shift();
  for (const dep of staticImports(readFileSync(path.join(DIST, "assets", file), "utf8"))) {
    if (!seen.has(dep)) {
      seen.set(dep, file);
      queue.push(dep);
    }
  }
}

const offenders = [...seen.keys()].filter((file) => FORBIDDEN.some((name) => file.startsWith(name)));
if (offenders.length) {
  for (const file of offenders) {
    const chain = [file];
    for (let parent = seen.get(file); parent; parent = seen.get(parent)) chain.unshift(parent);
    console.error(`check-entry-chunks: ${file} hängt statisch am Einstieg: ${chain.join(" → ")}`);
  }
  process.exit(1);
}
console.log(`check-entry-chunks: ${seen.size} Chunks am Einstieg, keine Admin-Bibliothek dabei`);
