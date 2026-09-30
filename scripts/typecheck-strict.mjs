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

const result = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.strict.json", "--pretty", "false"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const lines = output.split(/\r?\n/).filter((l) => /\(\d+,\d+\): error TS/.test(l));

const owned = [];
let legacy = 0;
for (const line of lines) {
  const file = path.normalize(line.slice(0, line.indexOf("("))).replace(/\\/g, "/");
  if (patterns.some((re) => re.test(file))) owned.push(line);
  else legacy += 1;
}

if (owned.length > 0) {
  console.error(owned.join("\n"));
  console.error(`\n✗ ${owned.length} Typfehler im strikt geprüften Code.`);
  process.exit(1);
}
console.log(`✓ Strikt geprüfter Code fehlerfrei (${legacy} Altfehler in importierten Legacy-Dateien ignoriert).`);
