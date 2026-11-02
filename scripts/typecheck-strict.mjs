/**
 * Strikter Typecheck (Ratchet).
 *
 * tsc läuft mit tsconfig.strict.json. Als Fehler zählen nur Dateien, die in
 * dessen "include" liegen – Fehler in transitiv importierten, noch nicht
 * aufgenommenen Dateien werden nur gezählt, nicht bewertet. Neue Dateien
 * kommen fehlerfrei in die Liste, bestehende nach ihrer Bereinigung.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const config = JSON.parse(fs.readFileSync("tsconfig.strict.json", "utf8"));
// "**/" steht für beliebig viele Verzeichnisse; erst danach einzelne "*" ersetzen,
// sonst würde "**" nur eine Ebene tief greifen.
const patterns = config.include.map((p) =>
  new RegExp(
    "^" +
      p
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*\//g, "\u0000")
        .replace(/\*/g, "[^/]*")
        .replace(/\u0000/g, "(?:.*/)?") +
      "$",
  ),
);

// TypeScript 7 (Befehl `tsc`, Paket `@typescript/native`). `node_modules/typescript` ist
// TypeScript 6.0 und nur für Werkzeuge mit Programmierschnittstelle da (ESLint, siehe AGENTS.md).
const result = spawnSync(process.execPath, ["node_modules/@typescript/native/bin/tsc", "-p", "tsconfig.strict.json", "--pretty", "false"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const lines = output.split(/\r?\n/).filter((l) => /\(\d+,\d+\): error TS/.test(l));

// TypeScript 7 ist ein natives Programm. Startet es nicht oder bricht es ohne Typfehler ab
// (etwa ohne die Binärdatei für diese Plattform), wäre die Prüfung sonst still grün.
if (result.error || (result.status !== 0 && lines.length === 0)) {
  console.error(output || String(result.error));
  console.error("\n✗ tsc ist nicht gelaufen.");
  process.exit(1);
}

const owned = [];
let legacy = 0;
for (const line of lines) {
  const file = path.normalize(line.slice(0, line.indexOf("("))).replace(/\\/g, "/");
  // Fehler in einer tsconfig (etwa eine Option, die TypeScript 7 entfernt hat) treffen die ganze
  // Prüfung und zählen immer, nicht als Altfehler.
  if (file.endsWith(".json") || patterns.some((re) => re.test(file))) owned.push(line);
  else legacy += 1;
}

if (owned.length > 0) {
  console.error(owned.join("\n"));
  console.error(`\n✗ ${owned.length} Typfehler im strikt geprüften Code.`);
  process.exit(1);
}
console.log(`✓ Strikt geprüfter Code fehlerfrei (${legacy} Altfehler in importierten Legacy-Dateien ignoriert).`);
