#
# Codemod Phase 1 - Identifier-Rename motorhome -> kitchen
#
# Ersetzt mechanisch in allen TypeScript/TSX-Dateien unter src/
# (ausser src/data/ratgeber, src/data/landing-page-*) die folgenden Identifier:
#
#   motorhome        -> kitchen
#   Motorhome        -> Kitchen
#   MOTORHOME        -> KITCHEN
#   vehicle_question -> kitchen_question   (nur im Kontext von Questions-Tabelle)
#
# Deutsche Content-Strings (Wohnmobil, Hymer, Knaus, Alkoven, ...) bleiben UNVERAENDERT.
# Die Roh-Anzahl der Treffer und betroffenen Dateien wird geloggt.
#
param(
  [switch]$DryRun = $false
)

$root = "C:\Users\PCUser\Projects\kuechenwert-v2"
$srcDir = "$root\src"

# Ordner die wir ausschliessen (reiner Content, wird separat behandelt)
$excludePatterns = @(
  '\src\\data\\ratgeber\\',
  '\src\\data\\landing-page-'
)

$replacements = @(
  @{ from = 'motorhome'; to = 'kitchen' }
  @{ from = 'Motorhome'; to = 'Kitchen' }
  @{ from = 'MOTORHOME'; to = 'KITCHEN' }
  @{ from = 'vehicle_questions'; to = 'kitchen_questions' }
)

$files = Get-ChildItem -Path $srcDir -Recurse -Include *.ts, *.tsx -File |
  Where-Object {
    $path = $_.FullName
    $excluded = $false
    foreach ($pat in $excludePatterns) {
      if ($path -match $pat) { $excluded = $true; break }
    }
    -not $excluded
  }

Write-Host "=== Codemod Phase 1 ==="
Write-Host "Dateien im Scope: $($files.Count)"
Write-Host "DryRun: $DryRun"
Write-Host ""

$totalMatches = 0
$changedFiles = 0
$fileReport = @()

foreach ($f in $files) {
  $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.UTF8Encoding]::new($false))
  $orig = $content
  $fileMatchCount = 0
  foreach ($r in $replacements) {
    $count = ([regex]::Matches($content, [regex]::Escape($r.from))).Count
    if ($count -gt 0) {
      $content = $content -creplace [regex]::Escape($r.from), $r.to
      $fileMatchCount += $count
    }
  }
  if ($content -ne $orig) {
    $changedFiles++
    $totalMatches += $fileMatchCount
    $rel = $f.FullName.Substring($root.Length + 1)
    $fileReport += [pscustomobject]@{ File = $rel; Matches = $fileMatchCount }
    if (-not $DryRun) {
      [System.IO.File]::WriteAllText($f.FullName, $content, [System.Text.UTF8Encoding]::new($false))
    }
  }
}

Write-Host ""
Write-Host "=== Zusammenfassung ==="
Write-Host "Geaenderte Dateien: $changedFiles"
Write-Host "Gesamt-Ersetzungen: $totalMatches"
Write-Host ""
Write-Host "=== Top 20 Dateien nach Matches ==="
$fileReport | Sort-Object -Property Matches -Descending | Select-Object -First 20 | ForEach-Object { "  $($_.Matches)`t$($_.File)" }
