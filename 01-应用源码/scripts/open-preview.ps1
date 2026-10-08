param([string]$Url = 'http://127.0.0.1:3210')
for ($appReadyAttempt = 0; $appReadyAttempt -lt 20; $appReadyAttempt++) {
  try {
    $appReadiness = Invoke-RestMethod -Uri ($Url + '/api/health') -TimeoutSec 1
    if ($appReadiness.ok) { Start-Process $Url; exit 0 }
  } catch {}
  Start-Sleep -Milliseconds 500
}
