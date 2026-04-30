$ErrorActionPreference = 'Continue'

$email  = 'info@wohnwert24.de'
$apiKey = '8057eb2fde70fe60ea0a3d2e7e9f2d09fb4fd'
$headers = @{
  'X-Auth-Email' = $email
  'X-Auth-Key'   = $apiKey
  'Content-Type' = 'application/json'
}

$zoneId = '90788f860ca8e39f2c0386226b770b79'

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

Write-Output 'Request body:'
Write-Output $body

$url = 'https://api.cloudflare.com/client/v4/zones/' + $zoneId + '/pagerules'

try {
  $r = Invoke-RestMethod -Uri $url -Headers $headers -Method POST -Body $body
  Write-Output 'SUCCESS'
  $r.result | ConvertTo-Json -Depth 10
}
catch {
  Write-Output 'FAIL - message:'
  Write-Output $_.Exception.Message
  $ed = $_.ErrorDetails
  if ($ed) {
    Write-Output 'ErrorDetails:'
    Write-Output $ed.Message
  }
}
