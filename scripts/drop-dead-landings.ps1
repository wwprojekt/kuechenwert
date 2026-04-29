# Einmal-Helper: loescht alle Caravan-Landing-Pages + ihre Data-Files.
# Ausnahme: LandingPageTemplate.tsx (reusable) + landing-page-types.ts + der
# Registry-File landing-pages.ts (wird separat minimiert).
$ErrorActionPreference = 'Stop'

$pages = @(
  'src/pages/landing/FinanziertenWohnwagenVerkaufen.tsx',
  'src/pages/landing/FinanziertesWohnmobilVerkaufen.tsx',
  'src/pages/landing/SchwackeListeWohnmobil.tsx',
  'src/pages/landing/WannWohnmobilVerkaufen.tsx',
  'src/pages/landing/WannWohnwagenVerkaufen.tsx',
  'src/pages/landing/WievielWohnmobilWert.tsx',
  'src/pages/landing/WirKaufenDeinWohnmobil.tsx',
  'src/pages/landing/WohnmobilAnkaufRatgeber.tsx',
  'src/pages/landing/WohnmobilHaendlerWerden.tsx',
  'src/pages/landing/WohnmobilVerkaufen.tsx',
  'src/pages/landing/WohnmobilVerkaufspreis.tsx',
  'src/pages/landing/WohnmobilWert.tsx',
  'src/pages/landing/WohnmobilWertermittlungKostenlos.tsx',
  'src/pages/landing/Wohnmobilpreise2026.tsx',
  'src/pages/landing/WohnwagenVerkaufen.tsx',
  'src/pages/landing/WohnwagenVerkaufspreis.tsx',
  'src/pages/landing/Wohnwagenpreise2026.tsx'
)

$datas = @(
  'src/data/landing-page-ankauf-ratgeber.ts',
  'src/data/landing-page-finanzierten-wohnwagen.ts',
  'src/data/landing-page-finanziertes.ts',
  'src/data/landing-page-preise-2026.ts',
  'src/data/landing-page-schwacke-liste.ts',
  'src/data/landing-page-verkaufspreis.ts',
  'src/data/landing-page-wann-verkaufen.ts',
  'src/data/landing-page-wann-wohnwagen-verkaufen.ts',
  'src/data/landing-page-wertermittlung-kostenlos.ts',
  'src/data/landing-page-wieviel-wert.ts',
  'src/data/landing-page-wir-kaufen.ts',
  'src/data/landing-page-wohnmobil-verkaufen.ts',
  'src/data/landing-page-wohnmobil-wert.ts',
  'src/data/landing-page-wohnwagen-verkaufen.ts',
  'src/data/landing-page-wohnwagen-verkaufspreis.ts',
  'src/data/landing-page-wohnwagenpreise-2026.ts'
)

$deleted = 0
foreach ($f in ($pages + $datas)) {
  if (Test-Path $f) {
    Remove-Item -LiteralPath $f
    Write-Output ("DELETED: " + $f)
    $deleted++
  } else {
    Write-Output ("SKIP (missing): " + $f)
  }
}
Write-Output ("files-deleted: " + $deleted)
