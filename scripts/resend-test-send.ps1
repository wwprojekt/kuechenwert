# Schickt eine Test-E-Mail ueber Resend, um zu verifizieren dass SPF+DKIM
# korrekt sind und die Mail tatsaechlich zugestellt wird.
#
# Voraussetzung: $env:RESEND_API_KEY = 're_...'

$ErrorActionPreference = 'Stop'

$resendKey = $env:RESEND_API_KEY
if (-not $resendKey) {
  Write-Error 'RESEND_API_KEY nicht gesetzt.'
  exit 1
}

$to = if ($args[0]) { $args[0] } else { 'info@wohnwert24.de' }

$tmpFile = Join-Path $env:TEMP 'resend-test-body.json'
@"
{
  "from": "KuechenWert <noreply@kuechenwert24.de>",
  "to": ["$to"],
  "subject": "Resend-Verification-Test — kuechenwert24.de",
  "html": "<p>Test-Mail: Wenn diese Mail in der Inbox landet (nicht Spam), funktioniert der Absender <code>noreply@kuechenwert24.de</code> inklusive SPF + DKIM.</p>",
  "text": "Test-Mail: Resend + kuechenwert24.de verified."
}
"@ | Set-Content -LiteralPath $tmpFile -Encoding utf8

try {
  $result = curl.exe -sS -X POST 'https://api.resend.com/emails' `
    -H "Authorization: Bearer $resendKey" `
    -H 'Content-Type: application/json' `
    --data-binary "@$tmpFile"
  Write-Output 'POST /emails response:'
  Write-Output $result

  $json = $result | ConvertFrom-Json
  if ($json.id) {
    Write-Output ''
    Write-Output 'Warte 3 Sekunden auf Delivery-Status ...'
    Start-Sleep -Seconds 3
    $status = curl.exe -sS "https://api.resend.com/emails/$($json.id)" -H "Authorization: Bearer $resendKey"
    Write-Output 'GET /emails/:id response:'
    Write-Output $status
  }
}
finally {
  if (Test-Path $tmpFile) { Remove-Item -LiteralPath $tmpFile -Force }
}
