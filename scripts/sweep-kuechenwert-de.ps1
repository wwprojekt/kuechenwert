# Migriert alle Vorkommen von `kuechenwert.de` (ohne 24) auf `kuechenwert24.de`
# in Edge Functions, Migrations, HTML und Scripts.
#
# Grund: Die Domain `küchenwert.de` (mit Umlaut) und ihre ASCII-Variante
# `kuechenwert.de` haben diverse Probleme (Punycode beim E-Mail-Versand,
# SSL-Zertifikate, Cookie-Scoping). Canonical ist `kuechenwert24.de`.
#
# Ersetzt werden:
#   info@kuechenwert.de      → info@kuechenwert24.de
#   noreply@kuechenwert.de   → noreply@kuechenwert24.de
#   support@kuechenwert.de   → support@kuechenwert24.de
#   hallo@kuechenwert.de     → hallo@kuechenwert24.de
#   kontakt@kuechenwert.de   → kontakt@kuechenwert24.de
#   https://kuechenwert.de   → https://kuechenwert24.de
#   https://www.kuechenwert.de → https://www.kuechenwert24.de
#   kuechenwert.de/...       → kuechenwert24.de/... (relative Pfade)
#   @kuechenwert.de          → @kuechenwert24.de (Fallback)
#
# ABSICHTLICH NICHT ersetzt:
#   kuechenwert24.de    (schon korrekt)
#   küchenwert.de       (Umlaut-Version wird zu kuechenwert24.de redirected,
#                        sollte aber nirgends hardgecoded sein — separate Suche)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot

$targets = @()
$targets += Get-ChildItem -Path "$root/supabase/functions" -Recurse -Include '*.ts','*.tsx','*.js','*.mjs','*.json','*.sql' -ErrorAction SilentlyContinue
$targets += Get-ChildItem -Path "$root/supabase/migrations" -Recurse -Include '*.sql' -ErrorAction SilentlyContinue
$targets += Get-ChildItem -Path "$root/src" -Recurse -Include '*.ts','*.tsx','*.css','*.html' -ErrorAction SilentlyContinue
$targets += Get-ChildItem -Path "$root/scripts" -Recurse -Include '*.ps1','*.mjs','*.sql' -ErrorAction SilentlyContinue
$targets += Get-ChildItem -Path "$root/public" -Recurse -Include '*.xml','*.html','*.txt','*.js' -ErrorAction SilentlyContinue
$targets += Get-ChildItem -Path "$root/worker" -Recurse -Include '*.ts','*.toml','*.js' -ErrorAction SilentlyContinue
$targets += Get-ChildItem -Path "$root/docker" -Recurse -Include '*.conf','Dockerfile*' -ErrorAction SilentlyContinue
# Root-level config
$targets += Get-Item -Path "$root/index.html" -ErrorAction SilentlyContinue
$targets += Get-Item -Path "$root/README.md" -ErrorAction SilentlyContinue

# Pattern order matters: longer matches first so we don't double-replace.
$patterns = @(
  @('https://www.kuechenwert.de', 'https://www.kuechenwert24.de'),
  @('https://kuechenwert.de',     'https://kuechenwert24.de'),
  @('www.kuechenwert.de',         'www.kuechenwert24.de'),
  @('info@kuechenwert.de',        'info@kuechenwert24.de'),
  @('noreply@kuechenwert.de',     'noreply@kuechenwert24.de'),
  @('support@kuechenwert.de',     'support@kuechenwert24.de'),
  @('hallo@kuechenwert.de',       'hallo@kuechenwert24.de'),
  @('kontakt@kuechenwert.de',     'kontakt@kuechenwert24.de'),
  @('admin@kuechenwert.de',       'admin@kuechenwert24.de'),
  # Fallback for any remaining @kuechenwert.de emails
  @('@kuechenwert.de',            '@kuechenwert24.de'),
  # Any remaining bare kuechenwert.de (e.g. in URLs without protocol)
  @('kuechenwert.de',             'kuechenwert24.de')
)

$totalFiles = 0
$totalReplacements = 0

foreach ($file in $targets) {
  if ($null -eq $file -or -not (Test-Path $file.FullName)) { continue }

  try {
    $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 -ErrorAction Stop
  } catch {
    Write-Output ("SKIP (read-error): " + $file.FullName)
    continue
  }
  if ($null -eq $content) { continue }

  $original = $content
  $fileReplacements = 0

  foreach ($p in $patterns) {
    $from = $p[0]
    $to   = $p[1]
    # Count replacements (escape for literal regex)
    $escapedFrom = [regex]::Escape($from)
    $matchCount = ([regex]::Matches($content, $escapedFrom)).Count
    if ($matchCount -gt 0) {
      $content = $content.Replace($from, $to)
      $fileReplacements += $matchCount
    }
  }

  if ($content -ne $original) {
    # UTF8 ohne BOM
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
    $relPath = $file.FullName.Substring($root.Length + 1)
    Write-Output ("UPDATED (" + $fileReplacements + "x): " + $relPath)
    $totalFiles++
    $totalReplacements += $fileReplacements
  }
}

Write-Output ""
Write-Output ("total-files: " + $totalFiles)
Write-Output ("total-replacements: " + $totalReplacements)
