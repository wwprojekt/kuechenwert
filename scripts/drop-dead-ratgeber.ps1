# Loescht alle Caravan-Brand- + Condition-Ratgeber-Data-Files.
# `ratgeber-meta.ts` und `ratgeber-index.ts` werden separat minimiert.
# `ratgeber-types.ts` + `RatgeberTemplate.tsx` + `RatgeberPage.tsx` bleiben
# als Gerueste fuer spaeter einzufuegende Kuechen-Ratgeber bestehen.
$ErrorActionPreference = 'Stop'

$files = @(
  'src/data/ratgeber/ratgeber-adria.ts',
  'src/data/ratgeber/ratgeber-buerstner.ts',
  'src/data/ratgeber/ratgeber-carado.ts',
  'src/data/ratgeber/ratgeber-carthago.ts',
  'src/data/ratgeber/ratgeber-chausson.ts',
  'src/data/ratgeber/ratgeber-concorde.ts',
  'src/data/ratgeber/ratgeber-condition-damage.ts',
  'src/data/ratgeber/ratgeber-condition-situation.ts',
  'src/data/ratgeber/ratgeber-dethleffs.ts',
  'src/data/ratgeber/ratgeber-hobby.ts',
  'src/data/ratgeber/ratgeber-hymer.ts',
  'src/data/ratgeber/ratgeber-knaus.ts',
  'src/data/ratgeber/ratgeber-laika.ts',
  'src/data/ratgeber/ratgeber-poessl.ts',
  'src/data/ratgeber/ratgeber-rapido.ts',
  'src/data/ratgeber/ratgeber-sunlight.ts',
  'src/data/ratgeber/ratgeber-weinsberg.ts'
)

$deleted = 0
foreach ($f in $files) {
  if (Test-Path $f) {
    Remove-Item -LiteralPath $f
    Write-Output ("DELETED: " + $f)
    $deleted++
  }
}
Write-Output ("ratgeber-files-deleted: " + $deleted)
