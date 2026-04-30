# Registriert kuechenwert24.de als Sending-Domain bei Resend und gibt die
# benoetigten DNS-Records (SPF, DKIM, Return-Path MX) zurueck.
#
# Wird einmalig gebraucht, um an die Domain-Verification-Records
# heranzukommen. Die DNS-Records werden manuell (oder per Cloudflare-API)
# in der Zone kuechenwert24.de eingetragen. Resend verifiziert anschliessend
# automatisch.
#
# Voraussetzung: Umgebungsvariable RESEND_API_KEY ist gesetzt.
#   $env:RESEND_API_KEY = 're_...'; .\scripts\resend-register-domain.ps1

$ErrorActionPreference = 'Stop'

$resendKey = $env:RESEND_API_KEY
if (-not $resendKey) {
  Write-Error 'RESEND_API_KEY ist nicht gesetzt. Erst `$env:RESEND_API_KEY = "re_..."` ausfuehren.'
  exit 1
}

$headers = @{
  'Authorization' = "Bearer $resendKey"
  'Content-Type'  = 'application/json'
}

$list = Invoke-RestMethod -Uri 'https://api.resend.com/domains' -Headers $headers -Method GET
$existing = $list.data | Where-Object { $_.name -eq 'kuechenwert24.de' }

if ($existing) {
  Write-Output 'Domain kuechenwert24.de ist bereits in Resend registriert:'
  $existing | ConvertTo-Json -Depth 10
  $domainId = $existing.id
} else {
  Write-Output 'Registriere kuechenwert24.de in Resend (region: eu-west-1)...'
  $body = @{
    name   = 'kuechenwert24.de'
    region = 'eu-west-1'
  } | ConvertTo-Json -Compress

  $r = Invoke-RestMethod -Uri 'https://api.resend.com/domains' -Headers $headers -Method POST -Body $body
  Write-Output 'Domain registriert:'
  $r | ConvertTo-Json -Depth 10
  $domainId = $r.id
}

Write-Output ''
Write-Output '=== DNS-Records fuer kuechenwert24.de ==='
$detail = Invoke-RestMethod -Uri "https://api.resend.com/domains/$domainId" -Headers $headers -Method GET
$detail.records | ForEach-Object {
  Write-Output ("`ntype:     " + $_.type)
  Write-Output ("record:   " + $_.record)
  Write-Output ("name:     " + $_.name)
  Write-Output ("value:    " + $_.value)
  if ($_.priority) { Write-Output ("priority: " + $_.priority) }
  Write-Output ("status:   " + $_.status)
}

Write-Output ''
Write-Output ("domain-id: " + $domainId)
Write-Output ("status:    " + $detail.status)
Write-Output ("sending:   " + $detail.capabilities.sending)
Write-Output ("receiving: " + $detail.capabilities.receiving)
