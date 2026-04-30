# Richtet in Cloudflare eine 301-Redirect-Rule auf der Umlaut-Zone
# (kǘchenwert.de / xn--kchenwert-q9a.de) ein, damit der gesamte Traffic auf
# kuechenwert24.de umgeleitet wird. Grund: Die Umlaut-Domain ist wegen
# Punycode-Problemen nicht nutzbar (siehe src/lib/brand/config.ts).
#
# Voraussetzungen:
#   $env:CF_AUTH_EMAIL = 'dein-cf-account@email.tld'
#   $env:CF_AUTH_KEY   = 'Global-API-Key aus Cloudflare Dashboard'

$ErrorActionPreference = 'Stop'

$email  = $env:CF_AUTH_EMAIL
$apiKey = $env:CF_AUTH_KEY
if (-not $email -or -not $apiKey) {
  Write-Error 'CF_AUTH_EMAIL und CF_AUTH_KEY muessen als Umgebungsvariablen gesetzt sein.'
  exit 1
}

$headers = @{
  'X-Auth-Email' = $email
  'X-Auth-Key'   = $apiKey
  'Content-Type' = 'application/json'
}

$zoneId = '90788f860ca8e39f2c0386226b770b79'  # küchenwert.de (Punycode: xn--kchenwert-q9a.de)

$body = @{
  targets = @(
    @{
      target     = 'url'
      constraint = @{ operator = 'matches'; value = '*xn--kchenwert-q9a.de/*' }
    }
  )
  actions = @(
    @{
      id    = 'forwarding_url'
      value = @{ url = 'https://kuechenwert24.de/$2'; status_code = 301 }
    }
  )
  priority = 1
  status   = 'active'
} | ConvertTo-Json -Depth 10 -Compress

$url = 'https://api.cloudflare.com/client/v4/zones/' + $zoneId + '/pagerules'

try {
  $r = Invoke-RestMethod -Uri $url -Headers $headers -Method POST -Body $body
  Write-Output 'Page Rule angelegt:'
  $r.result | ConvertTo-Json -Depth 10
}
catch {
  Write-Output 'FAIL:'
  Write-Output $_.Exception.Message
  if ($_.ErrorDetails) {
    Write-Output $_.ErrorDetails.Message
  }
}
