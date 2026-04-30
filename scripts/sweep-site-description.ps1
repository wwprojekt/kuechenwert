# Ersetzt Hardcoded site_description-Fallbacks in Edge Functions, die noch
# auf das alte Wohnmobil-Vokabular verweisen. Wird nur angewandt, wenn die
# Datenbank keinen site_settings-Eintrag hat (Fallback-Pfad) — dann wuerde
# eine E-Mail ohne den Fix mit "Deutschlands fuehrender Wohnmobil-
# Handelsplattform" signiert.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$targets = Get-ChildItem -Path "$root/supabase/functions" -Recurse -Include '*.ts' -ErrorAction SilentlyContinue

$patterns = @(
  @(
    'Deutschlands führende Wohnmobil-Handelsplattform',
    'Vergleichsportal für neue Küchen — Angebote einholen, Studio-Preise unterbieten, KI-Visualisierung.'
  ),
  @(
    "Deutschlands fuehrende Wohnmobil-Handelsplattform",
    'Vergleichsportal fuer neue Kuechen — Angebote einholen, Studio-Preise unterbieten, KI-Visualisierung.'
  ),
  @(
    'Deutschlands führender Wohnmobil-Handelsplattform',
    'dem Vergleichsportal für neue Küchen'
  ),
  @(
    "site_name: 'KuechenWert'",
    "site_name: 'KüchenWert'"
  ),
  @(
    'site_name: "KuechenWert"',
    'site_name: "KüchenWert"'
  )
)

$totalFiles = 0
$totalReplacements = 0

foreach ($file in $targets) {
  try {
    $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 -ErrorAction Stop
  } catch { continue }
  if ($null -eq $content) { continue }

  $original = $content
  $fileReplacements = 0

  foreach ($p in $patterns) {
    $from = $p[0]
    $to   = $p[1]
    $escapedFrom = [regex]::Escape($from)
    $matchCount = ([regex]::Matches($content, $escapedFrom)).Count
    if ($matchCount -gt 0) {
      $content = $content.Replace($from, $to)
      $fileReplacements += $matchCount
    }
  }

  if ($content -ne $original) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    try {
      [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
      $relPath = $file.FullName.Substring($root.Length + 1)
      Write-Output ("UPDATED (" + $fileReplacements + "x): " + $relPath)
      $totalFiles++
      $totalReplacements += $fileReplacements
    } catch {
      Write-Output ("SKIP (locked): " + $file.FullName)
    }
  }
}

Write-Output ""
Write-Output ("total-files: " + $totalFiles)
Write-Output ("total-replacements: " + $totalReplacements)
