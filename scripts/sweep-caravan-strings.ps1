# One-shot Codemod: ersetzt CaravanWert-URLs/Emails/Projekt-ID-Strings in
# allen Supabase-Edge-Function-Files mit den KuechenWert-Aequivalenten.
# Idempotent, sicher mehrfach auszufuehren.
$ErrorActionPreference = 'Stop'
$root = 'supabase/functions'

$patterns = @(
  @('info@caravanwert.de',                        'info@kuechenwert.de'),
  @('noreply@caravanwert.de',                     'noreply@kuechenwert.de'),
  @('support@caravanwert.de',                     'support@kuechenwert.de'),
  @('hallo@caravanwert.de',                       'hallo@kuechenwert.de'),
  @('kontakt@caravanwert.de',                     'kontakt@kuechenwert.de'),
  @('https://www.caravanwert.de',                 'https://www.kuechenwert24.de'),
  @('https://caravanwert.de',                     'https://kuechenwert24.de'),
  @('www.caravanwert.de',                         'www.kuechenwert24.de'),
  @('caravanwert.de',                             'kuechenwert24.de'),
  @('https://zcrwqxsyptjwkuxfacvq.supabase.co',   'https://gzqayoalwtmypndrmqes.supabase.co'),
  @('zcrwqxsyptjwkuxfacvq.supabase.co',           'gzqayoalwtmypndrmqes.supabase.co'),
  @('CaravanWert',                                'KuechenWert')
)

$touched = 0
Get-ChildItem -Path $root -Recurse -File -Include *.ts, *.tsx | ForEach-Object {
  $file = $_.FullName
  $orig = Get-Content -Raw -Encoding UTF8 -LiteralPath $file
  if ($null -eq $orig) { return }
  $new = $orig
  foreach ($p in $patterns) {
    $new = $new.Replace($p[0], $p[1])
  }
  if ($new -ne $orig) {
    Set-Content -LiteralPath $file -Value $new -NoNewline -Encoding UTF8
    Write-Output ("PATCHED: " + $file)
    $touched++
  }
}
Write-Output ("files-touched: " + $touched)
